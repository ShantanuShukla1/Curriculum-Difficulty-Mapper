from flask import Flask, jsonify, request
import tempfile
import os
import sqlite3
import pandas as pd
import networkx as nx
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def init_db():
    conn = sqlite3.connect('curriculum.db')
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
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
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
    ''')
    cursor.execute('DELETE FROM scores')
    cursor.execute('DELETE FROM courses')
    cursor.execute('DELETE FROM prerequisites')
    conn.commit()
    conn.close()

init_db()

# AI-ASSISTED
# Date: 07-02-2026
# Developer: Jonathan Michel
# Model: Claude Sonnet 4.6
# Prompt: "Write the CSV import logic to parse the curriculum CSV into the SQLite database, inserting courses and their prerequisite/corequisite relationships."
# Modifications: Removed filter excluding rows where Prefix == '0' to retain placeholder courses (e.g. capstone, theory) that may need to be displayed on the frontend
# Reason: Need to populate database with full curriculum data including courses with no scoring relationships
def import_csv(filepath):
    # CSV has 7 header/metadata rows before the actual column headers
    df = pd.read_csv(filepath, header=7)

    conn = sqlite3.connect('curriculum.db')
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

        cursor.execute('''
            INSERT INTO courses (course_id, prefix, number, term, credit_hours, failure_rate, frequency)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (course_id, prefix, number, term, credit_hours, failure_rate, frequency))

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

# TODO: hardcoded for development — import_csv should be called from the /upload endpoint instead

import_csv('CS_Curr.csv')

def build_graph():
    conn = sqlite3.connect('curriculum.db')
    cursor = conn.cursor()
    
    edges = cursor.execute(
        'SELECT prereq_id, course_id FROM prerequisites'
    ).fetchall()

    # Use autoincrement id (not course_id) so pathway rows with duplicate/null course_ids
    # remain distinct nodes
    db_ids = cursor.execute('SELECT id FROM courses').fetchall()

    conn.close()

    G = nx.DiGraph()
    G.add_nodes_from(row[0] for row in db_ids)
    G.add_edges_from(edges)
    return G
def compute_scores(G):
    conn = sqlite3.connect('curriculum.db')
    cursor = conn.cursor()

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

    for node in G.nodes():
        blocking = len(nx.descendants(G, node))
        # delay = longest path through this node; -1 avoids double-counting the node itself
        delay = longest_to[node] + longest_from[node] - 1

        cursor.execute('''
            INSERT INTO scores (course_id, blocking, delay)
            VALUES (?, ?, ?)
        ''', (node, blocking, delay))

    conn.commit()
    conn.close()

G = build_graph()
compute_scores(G)

@app.route('/curriculum', methods=['GET'])
def get_curriculum():
    conn = sqlite3.connect('curriculum.db')
    cursor = conn.cursor()

    # Use c.id (the database's own unique autoincrement id) instead of
    # c.course_id (the raw CSV id, which can be null or duplicated for
    # "pathway" placeholder courses like capstone/electives).
    courses_rows = cursor.execute('''
        SELECT c.id, c.course_id, c.prefix, c.number, c.term,
               c.credit_hours, c.failure_rate, c.frequency,
               s.blocking, s.delay, s.total
        FROM courses c
        LEFT JOIN scores s ON c.id = s.course_id
    ''').fetchall()

    # prerequisites already stores db ids directly (course_id/prereq_id in
    # this table are db ids, not CSV ids) so no join back through the
    # courses table is needed here at all.
    prereq_rows = cursor.execute('''
        SELECT course_id, prereq_id, type
        FROM prerequisites
    ''').fetchall()

    conn.close()

    # Build prereq lookup: db id -> list of {id, type}
    prereq_map = {}
    for (course_db_id, prereq_db_id, rel_type) in prereq_rows:
        prereq_map.setdefault(course_db_id, []).append({'id': prereq_db_id, 'type': rel_type})

    courses = []
    for row in courses_rows:
        db_id, csv_course_id, prefix, number, term, credit_hours, failure_rate, frequency, blocking, delay, total = row
        courses.append({
            'id': db_id,
            'course_id': csv_course_id,
            'prefix': prefix,
            'number': number,
            'term': term,
            'credit_hours': credit_hours,
            'failure_rate': failure_rate,
            'frequency': frequency,
            'blocking': blocking,
            'delay': delay,
            'total': total,
            'prerequisites': prereq_map.get(db_id, [])
        })

    curriculum_total = sum((c['blocking'] or 0) + (c['delay'] or 0) for c in courses)

    return jsonify({
        'curriculum_total': curriculum_total,
        'courses': courses
    })

@app.route('/upload', methods=['POST'])
def upload_csv():
    file = request.files.get('file')
    if not file:
        return jsonify({"status": "error", "message": "No file provided"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
        tmp_path = tmp.name
        file.save(tmp_path)

    try:
        init_db()
        import_csv(tmp_path)
        G = build_graph()
        compute_scores(G)
    finally:
        os.unlink(tmp_path)

    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True)
