from flask import Flask, jsonify, request, redirect, session
from functools import wraps
from cas import CASClient
import tempfile
import os
import sqlite3
import pandas as pd
import networkx as nx
from flask_cors import CORS

# Reserved username for the account that owns datasets uploaded before user
# ownership existed. Its datasets stay publicly viewable without login so
# the app still has something to show anonymous visitors out of the box.
DEMO_USERNAME = 'demo'

# Path to the SQLite database file. Defaults to the working directory for
# local dev; in K8s this should point inside the persistent volume's mount
# path so data survives pod restarts.
#
# K8s: set in a ConfigMap to a path under your PVC's mountPath, e.g.:
#   - name: DB_PATH
#     value: "/data/curriculum.db"
DB_PATH = os.environ.get('DB_PATH', 'curriculum.db')

app = Flask(__name__)

# SECRET_KEY signs the session cookie so clients can't forge or tamper with it.
# In development this fallback is fine, but in production you must set a real
# random value so sessions from one deploy aren't valid in another.
#
# K8s: create a Secret manifest with a strong random value, then reference it
# in your Deployment under spec.containers[].env:
#
#   - name: SECRET_KEY
#     valueFrom:
#       secretKeyRef:
#         name: flask-secrets   # name of your Secret object
#         key: secret-key
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-not-for-production')

# In production the app is served over HTTPS, so the browser should only send
# the session cookie on encrypted connections.
#
# K8s: add to your Deployment's env block (a plain ConfigMap value is fine here
# since it's not sensitive):
#   - name: SESSION_COOKIE_SECURE
#     value: "true"
if os.environ.get('SESSION_COOKIE_SECURE', '').lower() == 'true':
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# supports_credentials=True lets the browser send the session cookie on
# cross-origin requests (needed in local dev where the React dev server is on
# a different port than Flask). The origins list must be explicit — a wildcard
# "*" is not allowed alongside credentials.
#
# K8s: if your frontend and backend share the same public domain (typical when
# an ingress routes /api/* to Flask and everything else to React), they're
# same-origin and CORS isn't needed at all. If they're on different subdomains,
# add the frontend's URL to ALLOWED_ORIGINS in a ConfigMap:
#   - name: ALLOWED_ORIGINS
#     value: "https://jsn-capstone.cs.vt.edu"
CORS(app,
     supports_credentials=True,
     origins=os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173').split(','))

# ---------------------------------------------------------------------------
# CAS configuration
# ---------------------------------------------------------------------------

# SERVICE_URL is the public base URL of this Flask backend. CAS appends
# ?ticket=<ticket> to SERVICE_URL/api/login when redirecting the user back
# after a successful login, so this must be the URL the CAS server can reach.
#
# K8s: set this in a ConfigMap to your backend's ingress URL, e.g.:
#   - name: SERVICE_URL
#     value: "https://jsn-capstone-backend.cs.vt.edu"
# (no trailing slash)
SERVICE_URL = os.environ.get('SERVICE_URL', 'http://localhost:5000')

# FRONTEND_URL is where Flask sends the user after login/logout succeeds.
# This should be your React app's public URL.
#
# K8s: set in a ConfigMap, e.g.:
#   - name: FRONTEND_URL
#     value: "https://jsn-capstone.cs.vt.edu"
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

# CAS_SERVER_URL is the VT CAS server. Two options:
#   VT CAS:    https://login.vt.edu/profile/cas/
#   VT CS CAS: https://login.cs.vt.edu/cas/
#
# K8s: set in a ConfigMap so you can switch without rebuilding the image:
#   - name: CAS_SERVER_URL
#     value: "https://login.cs.vt.edu/cas/"
CAS_SERVER_URL = os.environ.get('CAS_SERVER_URL', 'https://login.cs.vt.edu/cas/')

# CASClient (from python-cas) does two things:
#   1. Builds the redirect URL that sends the user to the CAS login page.
#   2. Makes a back-channel HTTP request to CAS to validate the ticket and
#      get the authenticated username.
#
# The trailing "?" in service_url is required — CAS appends ?ticket=... to it,
# and without the "?" you'd get a URL like .../api/login?ticket=... only if
# the base already ends with "?".
cas_client = CASClient(
    version=2,
    service_url=f"{SERVICE_URL}/api/login?",
    server_url=CAS_SERVER_URL,
)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create tables if they don't already exist.
    # 'scores' columns (blocking, delay, etc.) are curriculum analytics metrics per course.
    # AI-ASSISTED
    # Date: 07-02-2027
    # Developer: Jonathan Michel
    # Model: Claude Sonnet 4.6
    # Prompt: "Write the SQLite to create the separate tables for the curriculum information, the prerequisite table, and the scoring table."
    # Modifications: Placed the given SQLite into the relevant python code and removed unnecessary columns
    # Reason: Need to move info from CSV to database
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT
        );

        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id INTEGER,
            course_id INTEGER,
            name TEXT,
            prefix TEXT,
            number INTEGER,
            failure_rate REAL,
            frequency INTEGER,
            term INTEGER,
            credit_hours INTEGER
        );

        CREATE TABLE IF NOT EXISTS prerequisites (
            course_id INTEGER,
            prereq_id INTEGER,
            type TEXT CHECK(type IN ('prereq', 'coreq')),
            PRIMARY KEY (course_id, prereq_id, type)
        );

        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            blocking INTEGER,
            delay INTEGER,
            failure INTEGER,
            frequency INTEGER,
            total INTEGER
        );

        CREATE TABLE IF NOT EXISTS dataset_shares (
            dataset_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (dataset_id, user_id)
        );
    ''')

    # datasets.owner_id was added after the original schema, so existing
    # databases need it backfilled in place. SQLite has no "ADD COLUMN IF
    # NOT EXISTS", so check PRAGMA table_info first.
    # (datasets.share_token from an earlier link-sharing design may still
    # exist on disk in older databases — it's unused dead data now that
    # sharing is per-person via dataset_shares, and is safe to ignore.)
    existing_columns = {row[1] for row in cursor.execute('PRAGMA table_info(datasets)').fetchall()}
    if 'owner_id' not in existing_columns:
        cursor.execute('ALTER TABLE datasets ADD COLUMN owner_id INTEGER')

    # Datasets created before ownership existed get assigned to the reserved
    # "demo" account rather than left with a NULL owner, so every dataset has
    # a real owner going forward and demo data stays intentionally public.
    demo_id = get_or_create_user(cursor, DEMO_USERNAME)
    cursor.execute('UPDATE datasets SET owner_id = ? WHERE owner_id IS NULL', (demo_id,))

    conn.commit()
    conn.close()

def get_or_create_user(cursor, username):
    row = cursor.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if row:
        return row[0]
    cursor.execute('INSERT INTO users (username) VALUES (?)', (username,))
    return cursor.lastrowid

init_db()

# AI-ASSISTED
# Date: 07-02-2026
# Developer: Jonathan Michel
# Model: Claude Sonnet 4.6
# Prompt: "Write the CSV import logic to parse the curriculum CSV into the SQLite database, inserting courses and their prerequisite/corequisite relationships."
# Modifications: Removed filter excluding rows where Prefix == '0' to retain placeholder courses (e.g. capstone, theory) that may need to be displayed on the frontend
# Reason: Need to populate database with full curriculum data including courses with no scoring relationships
def import_csv(filepath, dataset_id):
    # CSV has 7 header/metadata rows before the actual column headers
    df = pd.read_csv(filepath, header=7)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Maps CSV course_id → autoincrement db id, built during first pass.
    # Used in second pass so prerequisites reference db ids, not course_ids —
    # this keeps pathway rows with duplicate/missing course_ids distinct in the graph.
    course_id_map = {}
    prereq_rows = []

    for _, row in df.iterrows():
        prefix = str(row['Prefix']).strip()

        course_id_raw = str(row['Course ID']).strip()
        # NaN/empty course IDs (pathway rows) are allowed — store as None
        course_id = int(float(course_id_raw)) if course_id_raw not in ('nan', '') else None

        number_raw = str(row['Number']).strip()
        number = int(float(number_raw)) if number_raw not in ('nan', '', '0') else 0

        term_raw = str(row['Term']).strip()
        term = int(float(term_raw)) if term_raw not in ('nan', '') else None

        credit_hours_raw = str(row['Credit Hours']).strip()
        credit_hours = int(float(credit_hours_raw)) if credit_hours_raw not in ('nan', '') else None

        failure_rate_raw = str(row['Failure Rate']).strip().replace('%', '')
        failure_rate = float(failure_rate_raw) if failure_rate_raw not in ('nan', '') else None

        frequency_raw = str(row['Frequency']).strip()
        frequency = int(float(frequency_raw)) if frequency_raw not in ('nan', '') else None

        course_name_raw = str(row['Course Name']).strip()
        course_name = course_name_raw if course_name_raw not in ('nan', '') else None

        cursor.execute('''
            INSERT INTO courses (dataset_id, course_id, name, prefix, number, term, credit_hours, failure_rate, frequency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (dataset_id, course_id, course_name, prefix, number, term, credit_hours, failure_rate, frequency))

        db_id = cursor.lastrowid
        if course_id is not None:
            course_id_map[course_id] = db_id

        # Collect prereq/coreq rows to resolve in second pass after all courses are loaded.
        # Prerequisites and corequisites are semicolon-delimited Course IDs.
        # '0' and 'nan' both mean none.
        if course_id is not None:
            prereqs = str(row['Prerequisites']).strip()
            if prereqs not in ('0', 'nan', '0.0'):
                for p in prereqs.split(';'):
                    prereq_rows.append((course_id, int(float(p.strip())), 'prereq'))

            coreqs = str(row['Corequisites']).strip()
            if coreqs not in ('0', 'nan', '0.0'):
                for c in coreqs.split(';'):
                    prereq_rows.append((course_id, int(float(c.strip())), 'coreq'))

    # Second pass: insert prerequisites using db ids so each course row is a distinct graph node
    for (course_csv_id, prereq_csv_id, rel_type) in prereq_rows:
        course_db_id = course_id_map.get(course_csv_id)
        prereq_db_id = course_id_map.get(prereq_csv_id)
        if course_db_id is not None and prereq_db_id is not None:
            cursor.execute('''
                INSERT OR IGNORE INTO prerequisites (course_id, prereq_id, type)
                VALUES (?, ?, ?)
            ''', (course_db_id, prereq_db_id, rel_type))

    conn.commit()
    conn.close()

def build_graph(dataset_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Use autoincrement id (not course_id) so pathway rows with duplicate/null course_ids
    # remain distinct nodes
    db_ids = [row[0] for row in cursor.execute(
        'SELECT id FROM courses WHERE dataset_id = ?', (dataset_id,)
    ).fetchall()]
    id_set = set(db_ids)

    edges = cursor.execute(
        "SELECT prereq_id, course_id FROM prerequisites WHERE type IN ('prereq', 'coreq')"
    ).fetchall()
    edges = [e for e in edges if e[0] in id_set and e[1] in id_set]

    conn.close()

    G = nx.DiGraph()
    G.add_nodes_from(db_ids)
    G.add_edges_from(edges)
    return G

def compute_scores(G):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not nx.is_directed_acyclic_graph(G):
        raise ValueError("Curriculum graph contains a cycle — check for circular prerequisites/corequisites")

    topo = list(nx.topological_sort(G))

    # Longest path TO each node (inclusive) via forward DP over topological order
    longest_to = {node: 1 for node in G.nodes()}
    for node in topo:
        for pred in G.predecessors(node):
            if longest_to[pred] + 1 > longest_to[node]:
                longest_to[node] = longest_to[pred] + 1

    # Longest path FROM each node (inclusive) via backward DP
    longest_from = {node: 1 for node in G.nodes()}
    for node in reversed(topo):
        for succ in G.successors(node):
            if longest_from[succ] + 1 > longest_from[node]:
                longest_from[node] = longest_from[succ] + 1

    course_data = {
        row[0]: {'failure_rate': row[1], 'frequency': row[2]}
        for row in cursor.execute('SELECT id, failure_rate, frequency FROM courses').fetchall()
    }

    for node in G.nodes():
        blocking = len(nx.descendants(G, node))
        delay = longest_to[node] + longest_from[node] - 1

        rate = course_data[node]['failure_rate']
        if rate is None:
            failure = 0
        elif rate <= 5:
            failure = 0
        elif rate <= 10:
            failure = 1
        elif rate <= 15:
            failure = 2
        elif rate <= 20:
            failure = 3
        else:
            failure = 4

        freq = course_data[node]['frequency']
        if freq is None or freq >= 3:
            frequency = 0
        elif freq == 2:
            frequency = 1
        else:
            frequency = 2

        total = blocking + delay + failure + frequency

        cursor.execute('''
            INSERT INTO scores (course_id, blocking, delay, failure, frequency, total)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (node, blocking, delay, failure, frequency, total))

    conn.commit()
    conn.close()

# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def login_required(f):
    """
    Wraps a route so it returns 401 if the user isn't logged in.
    session['user'] is set by /api/login after CAS validates the ticket.
    Apply this decorator to any route that should only be accessible to
    authenticated users.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentication required. Please log in via /api/login.'}), 401
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# CAS auth routes
# ---------------------------------------------------------------------------

@app.route('/api/login')
def login():
    """
    Handles two cases depending on whether a CAS ticket is in the query string.

    Case 1 — No ticket (?ticket not in URL):
        The user hasn't authenticated yet. Redirect their browser to the CAS
        login page. CAS will authenticate them and then redirect back to this
        same endpoint with ?ticket=<ticket> appended.

    Case 2 — Ticket present (?ticket=ST-...):
        CAS is returning the user after a successful login. Validate the ticket
        by making a back-channel HTTP request to CAS (verify_ticket does this).
        If valid, CAS returns the username; store it in the Flask session and
        redirect to the frontend. If invalid (expired, reused, wrong service),
        redirect to the frontend with an error flag.
    """
    ticket = request.args.get('ticket')

    if not ticket:
        # No ticket — redirect the browser to the CAS login page.
        # get_login_url() builds: {CAS_SERVER_URL}/login?service={SERVICE_URL}/api/login?
        return redirect(cas_client.get_login_url())

    # Ticket present — validate it against the CAS server.
    # verify_ticket() returns (username, attributes_dict, pgtiou) on success,
    # or (None, None, None) if the ticket is invalid or already used.
    user, attributes, pgtiou = cas_client.verify_ticket(ticket)

    if not user:
        # Ticket invalid or expired. Redirect to frontend with an error flag
        # so the UI can display a message instead of silently looping.
        return redirect(f"{FRONTEND_URL}?error=auth_failed")

    # Ticket valid — store the username in the session.
    # Flask serialises session to a signed cookie; the signature uses SECRET_KEY
    # so the client can't forge or modify the session contents.
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    user_id = get_or_create_user(cursor, user)
    conn.commit()
    conn.close()

    session['user'] = user
    session['user_id'] = user_id

    return redirect(FRONTEND_URL)


@app.route('/api/logout')
def logout():
    """
    Clears the Flask session (so subsequent requests see no logged-in user)
    and redirects to the CAS logout endpoint.

    Logging out via CAS also invalidates the user's SSO session, which means
    they're logged out of *all* CAS-protected services, not just this one.
    get_logout_url() builds: {CAS_SERVER_URL}/logout?service={FRONTEND_URL}
    CAS logs them out and redirects back to the frontend.
    """
    session.clear()
    return redirect(cas_client.get_logout_url(redirect_url=FRONTEND_URL))


@app.route('/api/user')
@login_required
def get_user():
    """
    Returns the currently logged-in username.
    The React frontend calls this on page load to decide whether to show the
    app or redirect to /api/login. Returns 401 (via login_required) if no
    active session exists.
    """
    return jsonify({'user': session['user']})


# ---------------------------------------------------------------------------
# Curriculum routes
#
#   GET /api/curriculum        — no id: logged-in users get their own most
#                                 recent dataset (falling back to demo if they
#                                 have none yet); anonymous users get the demo
#                                 user's most recent dataset. Always accessible
#                                 since it only ever resolves to a dataset the
#                                 requester already has rights to.
#   GET /api/curriculum/<id>   — a specific dataset. Datasets owned by the
#                                 reserved "demo" user are public; anything
#                                 else requires CAS login, and the requester
#                                 must either own it or appear in its
#                                 dataset_shares list (403 otherwise).
# ---------------------------------------------------------------------------

def _get_dataset_owner(cursor, dataset_id):
    row = cursor.execute('SELECT owner_id FROM datasets WHERE id = ?', (dataset_id,)).fetchone()
    return row[0] if row else None

def _is_shared_with(cursor, dataset_id, user_id):
    row = cursor.execute(
        'SELECT 1 FROM dataset_shares WHERE dataset_id = ? AND user_id = ?',
        (dataset_id, user_id)
    ).fetchone()
    return row is not None

def _check_dataset_access(cursor, dataset_id, session_user_id, demo_id):
    """Returns None if the requester may view this dataset, otherwise an
    (response, status) tuple the caller should return immediately."""
    owner_id = _get_dataset_owner(cursor, dataset_id)
    if owner_id is None:
        return jsonify({'error': 'Dataset not found'}), 404
    if owner_id == demo_id:
        return None
    if session_user_id is None:
        return jsonify({'error': 'Authentication required. Please log in via /api/login.'}), 401
    if session_user_id != owner_id and not _is_shared_with(cursor, dataset_id, session_user_id):
        return jsonify({'error': 'You do not have access to this dataset'}), 403
    return None

def _serialize_curriculum(cursor, dataset_id):
    # Use c.id (the database's own unique autoincrement id) instead of
    # c.course_id (the raw CSV id, which can be null or duplicated for
    # "pathway" placeholder courses like capstone/electives).
    courses_rows = cursor.execute('''
        SELECT c.id, c.course_id, c.name, c.prefix, c.number, c.term,
               c.credit_hours, s.blocking, s.delay, s.failure, s.frequency, s.total
        FROM courses c
        LEFT JOIN scores s ON c.id = s.course_id
        WHERE c.dataset_id = ?
    ''', (dataset_id,)).fetchall()

    # prerequisites stores db ids directly. Filter to this dataset by
    # joining back through courses on the course_id side — prereq_id will
    # always belong to the same dataset since import_csv only ever links
    # ids within a single import run.
    prereq_rows = cursor.execute('''
        SELECT p.course_id, p.prereq_id, p.type
        FROM prerequisites p
        JOIN courses c ON p.course_id = c.id
        WHERE c.dataset_id = ?
    ''', (dataset_id,)).fetchall()

    # Build prereq lookup: db id -> list of {id, type}
    prereq_map = {}
    for (course_db_id, prereq_db_id, rel_type) in prereq_rows:
        prereq_map.setdefault(course_db_id, []).append({'id': prereq_db_id, 'type': rel_type})

    courses = []
    for row in courses_rows:
        db_id, csv_course_id, name, prefix, number, term, credit_hours, blocking, delay, failure, frequency, total = row
        courses.append({
            'id': db_id,                # unique, safe to use as a graph key
            'course_id': csv_course_id, # original CSV id, kept for reference/display only
            'name': name,
            'prefix': prefix,
            'number': number,
            'term': term,
            'credit_hours': credit_hours,
            'blocking': blocking,
            'delay': delay,
            'failure': failure,
            'frequency': frequency,
            'total': total,
            'prerequisites': prereq_map.get(db_id, [])
        })

    return {
        'dataset_id': dataset_id,
        'curriculum_total': sum(c['total'] or 0 for c in courses),
        'total_blocking': sum(c['blocking'] or 0 for c in courses),
        'total_delay': sum(c['delay'] or 0 for c in courses),
        'total_failure': sum(c['failure'] or 0 for c in courses),
        'total_frequency': sum(c['frequency'] or 0 for c in courses),
        'courses': courses
    }

@app.route('/api/curriculum', methods=['GET'])
def get_curriculum():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    demo_id = get_or_create_user(cursor, DEMO_USERNAME)
    session_user_id = session.get('user_id')

    dataset_id = None
    if session_user_id is not None:
        latest = cursor.execute(
            'SELECT id FROM datasets WHERE owner_id = ? ORDER BY id DESC LIMIT 1', (session_user_id,)
        ).fetchone()
        dataset_id = latest[0] if latest else None

    if dataset_id is None:
        latest = cursor.execute(
            'SELECT id FROM datasets WHERE owner_id = ? ORDER BY id DESC LIMIT 1', (demo_id,)
        ).fetchone()
        dataset_id = latest[0] if latest else None

    if dataset_id is None:
        conn.close()
        return jsonify({
            'curriculum_total': 0,
            'total_blocking': 0,
            'total_delay': 0,
            'total_failure': 0,
            'total_frequency': 0,
            'courses': []
        })

    result = _serialize_curriculum(cursor, dataset_id)
    conn.close()
    return jsonify(result)

@app.route('/api/curriculum/<int:dataset_id>', methods=['GET'])
def get_curriculum_by_id(dataset_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    demo_id = get_or_create_user(cursor, DEMO_USERNAME)
    session_user_id = session.get('user_id')

    error = _check_dataset_access(cursor, dataset_id, session_user_id, demo_id)
    if error:
        conn.close()
        return error

    result = _serialize_curriculum(cursor, dataset_id)
    conn.close()
    return jsonify(result)

@app.route('/api/datasets', methods=['GET'])
@login_required
def list_datasets():
    """Lists datasets the logged-in user owns, plus datasets shared with them."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    owned = cursor.execute('''
        SELECT id, label
        FROM datasets
        WHERE owner_id = ?
        ORDER BY id DESC
    ''', (session['user_id'],)).fetchall()

    shared = cursor.execute('''
        SELECT d.id, d.label, u.username
        FROM datasets d
        JOIN dataset_shares ds ON ds.dataset_id = d.id
        JOIN users u ON u.id = d.owner_id
        WHERE ds.user_id = ?
        ORDER BY d.id DESC
    ''', (session['user_id'],)).fetchall()

    conn.close()

    datasets = [
        {'id': r[0], 'label': r[1], 'access': 'owner'}
        for r in owned
    ] + [
        {'id': r[0], 'label': r[1], 'access': 'shared', 'owner_username': r[2]}
        for r in shared
    ]

    return jsonify({'datasets': datasets})

def _require_owned_dataset(cursor, dataset_id, session_user_id):
    """Returns None if the dataset exists and is owned by session_user_id,
    otherwise returns the (response, status) tuple the caller should return."""
    owner_id = _get_dataset_owner(cursor, dataset_id)
    if owner_id is None:
        return jsonify({'error': 'Dataset not found'}), 404
    if owner_id != session_user_id:
        return jsonify({'error': 'You do not have access to this dataset'}), 403
    return None

def _shared_usernames(cursor, dataset_id):
    rows = cursor.execute('''
        SELECT u.username
        FROM dataset_shares ds
        JOIN users u ON u.id = ds.user_id
        WHERE ds.dataset_id = ?
        ORDER BY u.username
    ''', (dataset_id,)).fetchall()
    return [r[0] for r in rows]

@app.route('/api/datasets/<int:dataset_id>/shares', methods=['GET'])
@login_required
def get_dataset_shares(dataset_id):
    """Lists the VT PIDs a dataset is currently shared with. Owner-only."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    error = _require_owned_dataset(cursor, dataset_id, session['user_id'])
    if error:
        conn.close()
        return error

    usernames = _shared_usernames(cursor, dataset_id)
    conn.close()
    return jsonify({'dataset_id': dataset_id, 'shared_with': usernames})

@app.route('/api/datasets/<int:dataset_id>/share', methods=['POST'])
@login_required
def share_dataset(dataset_id):
    """Grants a specific VT PID access to a dataset. Owner-only.

    If the PID has never logged into the app before, a placeholder users
    row is created for them (same helper CAS login uses) so the grant is
    ready and waiting for their first login.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    error = _require_owned_dataset(cursor, dataset_id, session['user_id'])
    if error:
        conn.close()
        return error

    username = (request.get_json(silent=True) or {}).get('username', '').strip()
    if not username:
        conn.close()
        return jsonify({'error': 'username is required'}), 400

    target_user_id = get_or_create_user(cursor, username)
    cursor.execute(
        'INSERT OR IGNORE INTO dataset_shares (dataset_id, user_id) VALUES (?, ?)',
        (dataset_id, target_user_id)
    )
    conn.commit()

    usernames = _shared_usernames(cursor, dataset_id)
    conn.close()
    return jsonify({'dataset_id': dataset_id, 'shared_with': usernames})

@app.route('/api/datasets/<int:dataset_id>/share/<username>', methods=['DELETE'])
@login_required
def unshare_dataset(dataset_id, username):
    """Revokes a specific VT PID's access to a dataset. Owner-only."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    error = _require_owned_dataset(cursor, dataset_id, session['user_id'])
    if error:
        conn.close()
        return error

    row = cursor.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if row is None:
        conn.close()
        return jsonify({'error': 'No such user'}), 404

    cursor.execute(
        'DELETE FROM dataset_shares WHERE dataset_id = ? AND user_id = ?',
        (dataset_id, row[0])
    )
    conn.commit()

    usernames = _shared_usernames(cursor, dataset_id)
    conn.close()
    return jsonify({'dataset_id': dataset_id, 'shared_with': usernames})

@app.route('/api/upload', methods=['POST'])
@login_required
def upload_csv():
    file = request.files.get('file')
    if not file:
        return jsonify({"status": "error", "message": "No file provided"}), 400

    #Optional url name
    label = request.form.get('label') or file.filename

    with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
        tmp_path = tmp.name
        file.save(tmp_path)

    try:
        init_db()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO datasets (label, owner_id) VALUES (?, ?)',
            (label, session['user_id'])
        )
        dataset_id = cursor.lastrowid

        conn.commit()
        conn.close()

        import_csv(tmp_path, dataset_id)
        G = build_graph(dataset_id)
        compute_scores(G)
    finally:
        os.unlink(tmp_path)

    return jsonify({"status": "success", "dataset_id": dataset_id})

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)