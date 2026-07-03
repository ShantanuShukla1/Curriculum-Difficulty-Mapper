from flask import Flask, jsonify
import sqlite3
import pandas as pd
import networkx as nx

app = Flask(__name__)

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

        cursor.execute('''
            INSERT INTO courses (course_id, prefix, number)
            VALUES (?, ?, ?)
        ''', (course_id, prefix, number))

        db_id = cursor.lastrowid
        if course_id is not None:
            course_id_map[course_id] = db_id

        # Collect prereq/coreq rows to resolve in second pass after all courses are loaded.
        # Prerequisites and corequisites are semicolon-delimited Course IDs.
        # '0' and 'nan' both mean none.
        if course_id is not None:
            prereqs = str(row['Prerequisites']).strip()
            if prereqs not in ('0', 'nan'):
                for p in prereqs.split(';'):
                    prereq_rows.append((course_id, int(p.strip()), 'prereq'))

            coreqs = str(row['Corequisites']).strip()
            if coreqs not in ('0', 'nan'):
                for c in coreqs.split(';'):
                    prereq_rows.append((course_id, int(c.strip()), 'coreq'))

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
    
    for course_id in G.nodes():
        # blocking: number of courses this course directly/indirectly blocks
        blocking = len(nx.descendants(G, course_id))
        
        # delay: length of longest prereq chain this course appears on
        relevant_nodes = nx.ancestors(G, course_id) | {course_id} | nx.descendants(G, course_id)
        subgraph = G.subgraph(relevant_nodes)
        longest_path = nx.dag_longest_path(subgraph)
        delay = len(longest_path) if course_id in longest_path else 1
        
        cursor.execute('''
            INSERT INTO scores (course_id, blocking, delay)
            VALUES (?, ?, ?)
        ''', (course_id, blocking, delay))
    
    conn.commit()
    conn.close()

G = build_graph()
compute_scores(G)

@app.route('/curriculum', methods=['GET'])
def get_curriculum():
    return jsonify({"message": "hello from flask"})

@app.route('/upload', methods=['POST'])
def upload_csv():
    # TODO: receive uploaded CSV file here and call import_csv() with it
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True)
