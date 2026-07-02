from flask import Flask, jsonify
import sqlite3
import pandas as pd

app = Flask(__name__)

def init_db():
    conn = sqlite3.connect('curriculum.db')
    cursor = conn.cursor()

    # Create tables if they don't already exist.
    # 'scores' columns (blocking, delay, etc.) are curriculum analytics metrics per course.
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS courses (
            course_id INTEGER PRIMARY KEY,
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
            course_id INTEGER PRIMARY KEY,
            blocking INTEGER,
            delay INTEGER,
            failure INTEGER,
            frequency INTEGER,
            total INTEGER
        );
    ''')

    conn.commit()
    conn.close()

init_db()

def import_csv(filepath):
    # CSV has 7 header/metadata rows before the actual column headers
    df = pd.read_csv(filepath, header=7)

    # Skip elective/placeholder rows (Prefix == '0') and rows without a Course ID
    df = df[df['Prefix'] != '0'].copy()
    df = df.dropna(subset=['Course ID'])

    conn = sqlite3.connect('curriculum.db')
    cursor = conn.cursor()

    for _, row in df.iterrows():
        course_id = int(row['Course ID'])
        prefix = str(row['Prefix']).strip()
        number = int(row['Number'])

        cursor.execute('''
            INSERT OR REPLACE INTO courses (course_id, prefix, number)
            VALUES (?, ?, ?)
        ''', (course_id, prefix, number))

        # Prerequisites and corequisites are semicolon-delimited Course IDs.
        # '0' and 'nan' both mean none.
        prereqs = str(row['Prerequisites']).strip()
        if prereqs not in ('0', 'nan'):
            for p in prereqs.split(';'):
                cursor.execute('''
                    INSERT OR IGNORE INTO prerequisites (course_id, prereq_id, type)
                    VALUES (?, ?, 'prereq')
                ''', (course_id, int(p.strip())))

        coreqs = str(row['Corequisites']).strip()
        if coreqs not in ('0', 'nan'):
            for c in coreqs.split(';'):
                cursor.execute('''
                    INSERT OR IGNORE INTO prerequisites (course_id, prereq_id, type)
                    VALUES (?, ?, 'coreq')
                ''', (course_id, int(c.strip())))

    conn.commit()
    conn.close()

# TODO: hardcoded for development — import_csv should be called from the /upload endpoint instead
import_csv('CS_Curr.csv')

@app.route('/curriculum', methods=['GET'])
def get_curriculum():
    return jsonify({"message": "hello from flask"})

@app.route('/upload', methods=['POST'])
def upload_csv():
    # TODO: receive uploaded CSV file here and call import_csv() with it
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True)
