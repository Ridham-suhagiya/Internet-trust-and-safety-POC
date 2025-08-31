# app.py
# This script contains the Flask backend for the domain abuse mitigation system.
# It handles API requests for creating, retrieving, and updating abuse reports.

import psycopg2
import io
import psycopg2.extras
import csv
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests


app = Flask(__name__)
CORS(app) # Enable CORS for frontend communication

# --- PostgreSQL Connection Details ---
# You must fill in your own PostgreSQL credentials here.
# For example:
# PG_DATABASE = 'your_database_name'
# PG_USER = 'your_username'
# PG_PASSWORD = 'your_password'
# PG_HOST = 'your_host' (e.g., 'localhost' or an IP address)
# ---

PG_DATABASE = os.environ.get('PG_DATABASE', 'abuse_db')
PG_USER = os.environ.get('PG_USER', 'postgres')
PG_PASSWORD = os.environ.get('PG_PASSWORD', 'password')
PG_HOST = os.environ.get('PG_HOST', 'localhost')

def get_db_connection():
    """
    Establishes a connection to the PostgreSQL database.
    """
    conn = psycopg2.connect(
        database=PG_DATABASE,
        user=PG_USER,
        password=PG_PASSWORD,
        host=PG_HOST,
        port=5432
    )
    return conn

def insert_reports_to_db(reports):
    imported_count = 0
    print(reports, "ifnvofsn")
    conn = get_db_connection()
    for row in reports:
        try:
            # Basic validation of CSV columns
            if not all(k in row for k in ["domain_name", "abuse_type", "report_source", "confidence_score"]):
                errors.append({"row": row, "error": "Missing one or more required columns"})
                continue
                
            confidence_score = int(row["confidence_score"])
            if not 0 <= confidence_score <= 100:
                errors.append({"row": row, "error": "Confidence score is not between 0 and 100."})
                continue
            
            # Create the new report
            risk_score = determine_risk_level(row["abuse_type"], confidence_score, row["domain_name"])
            new_report = {
                "domain_name": row["domain_name"],
                "abuse_type": row["abuse_type"],
                "report_source": row["report_source"],
                "confidence_score": confidence_score,
                "status": "New",
                "risk_score": risk_score,
                "reviewer_id": None,
            }
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO reports 
                (domain_name, report_source, abuse_type, confidence_score, status, risk_score, reviewer_id, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
                ''', 
                ( new_report["domain_name"].strip(), 
                  new_report["report_source"].strip(), 
                  new_report["abuse_type"].strip(), 
                  new_report["confidence_score"], 
                  new_report["status"], 
                  new_report["risk_score"], 
                  new_report["reviewer_id"])
            )
            imported_count += 1
        except ValueError:
            errors.append({"row": row, "error": "Invalid confidence score (must be a number)"})
    conn.commit()
    return imported_count

def setup_database():
    """
    Creates the 'reports' table in the PostgreSQL database if it doesn't exist.
    This also handles the 'migration' for our simple schema.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                domain_name TEXT NOT NULL,
                abuse_type TEXT NOT NULL,
                report_source TEXT NOT NULL,
                confidence_score INTEGER NOT NULL,
                status TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                reviewer_id TEXT,
                last_updated TIMESTAMP NOT NULL
            )
        ''')
        conn.commit()
        print("Database setup complete.")
    except psycopg2.Error as e:
        print(f"Error setting up database: {e}")
    finally:
        if conn:
            conn.close()

def determine_risk_level(abuse_type, confidence_score, domain_name):
    """
    Applies business logic to determine the risk level of a domain.
    Returns 100 for 'High Risk' and 50 for 'Standard Risk'.
    """
    suspicious_keywords = ['paypal', 'secure', 'login', 'chase', 'amazon', 'bank']
    is_high_risk = False
    
    if confidence_score > 80:
        is_high_risk = True
    
    if abuse_type.lower() in ['phishing', 'malware']:
        is_high_risk = True
        
    for keyword in suspicious_keywords:
        if keyword in domain_name.lower():
            is_high_risk = True
            break
            
    return 100 if is_high_risk else 50

# A simple API endpoint for status check.
@app.route('/')
def home():
    """Simple API status check."""
    return jsonify({"message": "API is running."})

# POST API to create a new report.
@app.route('/reports', methods=['POST'])
def create_report():
    """
    API endpoint to create a new abuse report.
    Expects a JSON payload with domain_name, report_source, abuse_type, and confidence_score.
    """
    conn = None
    try:
        data = request.json
        domain_name = data['domain_name']
        report_source = data['report_source']        
        abuse_type = data['abuse_type']
        confidence_score = data['confidence_score']
        
        # Simple input validation
        print(domain_name , report_source , abuse_type , confidence_score is None)
        if not domain_name or not report_source or not abuse_type or confidence_score is None:
            return jsonify({"error": "Missing required fields."}), 400

        print("idoidsnvosdinvo")
        risk_score = determine_risk_level(abuse_type, confidence_score, domain_name)
        status = 'New'
        reviewer_id = None
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO reports 
            (domain_name, report_source, abuse_type, confidence_score, status, risk_score, reviewer_id, last_updated)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING id
        ''', (domain_name.strip(), report_source.strip(), abuse_type.strip(), confidence_score, status, risk_score, reviewer_id))
        report_id = cursor.fetchone()[0]
        conn.commit()
        
        return jsonify({"message": "Report created successfully.", "id": report_id}), 201

    except psycopg2.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# GET API to fetch all reports.
@app.route('/reports', methods=['GET'])
def get_reports():
    """
    API endpoint to retrieve all abuse reports.
    """    
    conn = None
    try:
        conn = get_db_connection()
        # Use RealDictCursor to fetch rows as dictionaries
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT * FROM reports')
        reports = cursor.fetchall()
        return jsonify(reports), 200

    except psycopg2.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# GET API for a specific domain's report history.
@app.route('/reports/<string:domain_name>', methods=['GET'])
def get_report_by_domain(domain_name):
    """
    API endpoint to retrieve all reports for a specific domain.
    """
    conn = None
    try: 
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT * FROM reports WHERE domain_name = %s ORDER BY last_updated DESC', (domain_name.strip(),))
        reports = cursor.fetchall()

        if not reports:
            return jsonify({"error": "No reports found for this domain."}), 404
        
        return jsonify(reports), 200
        
    except psycopg2.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# PUT API to update a report's status and reviewer.
@app.route('/reports/<int:report_id>', methods=['PUT'])
def update_report_status(report_id):
    """
    API endpoint to update the status and reviewer ID of a specific report.
    Expects a JSON payload with 'status' and 'reviewer_id'.
    """
    conn = None
    try:
        data = request.json
        status = data.get('status')
        reviewer_id = data.get('reviewer_id')
        
        if not status or not reviewer_id:
            return jsonify({"error": "Status and reviewer_id are required fields."}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if the report exists
        cursor.execute('SELECT id FROM reports WHERE id = %s', (report_id,))
        if cursor.fetchone() is None:
            return jsonify({"error": "Report not found."}), 404

        cursor.execute('''
            UPDATE reports SET status = %s, reviewer_id = %s, last_updated = NOW() WHERE id = %s
        ''', (status, reviewer_id, report_id))
        conn.commit()
        
        return jsonify({"message": f"Report {report_id} updated successfully."}), 200

    except psycopg2.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/reports/batch-import', methods=['POST'])
def batch_import():
    """Accepts a CSV file and imports abuse reports."""

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Invalid file type. Please upload a CSV file."}), 400

    stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
    csv_reader = csv.DictReader(stream)
    
    imported_count = 0
    errors = []
    # conn = get_db_connection()
    # for row in csv_reader:
    #     try:
    #         # Basic validation of CSV columns
    #         if not all(k in row for k in ["domain_name", "abuse_type", "report_source", "confidence_score"]):
    #             errors.append({"row": row, "error": "Missing one or more required columns"})
    #             continue
                
    #         confidence_score = int(row["confidence_score"])
    #         if not 0 <= confidence_score <= 100:
    #             errors.append({"row": row, "error": "Confidence score is not between 0 and 100."})
    #             continue
            
    #         # Create the new report
    #         risk_score = determine_risk_level(row["abuse_type"], confidence_score, row["domain_name"])
    #         new_report = {
    #             "domain_name": row["domain_name"],
    #             "abuse_type": row["abuse_type"],
    #             "report_source": row["report_source"],
    #             "confidence_score": confidence_score,
    #             "status": "New",
    #             "risk_score": risk_score,
    #             "reviewer_id": None,
    #         }
    #         cursor = conn.cursor()
    #         cursor.execute('''
    #             INSERT INTO reports 
    #             (domain_name, report_source, abuse_type, confidence_score, status, risk_score, reviewer_id, last_updated)
    #             VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
    #             RETURNING id
    #             ''', 
    #             ( new_report["domain_name"].strip(), 
    #               new_report["report_source"].strip(), 
    #               new_report["abuse_type"].strip(), 
    #               new_report["confidence_score"], 
    #               new_report["status"], 
    #               new_report["risk_score"], 
    #               new_report["reviewer_id"])
    #         )
    #         imported_count += 1
            
    #     except ValueError:
    #         errors.append({"row": row, "error": "Invalid confidence score (must be a number)"})
    # conn.commit()
    imported_count = insert_reports_to_db(list(csv_reader))
    return jsonify({
        "message": f"Successfully imported {imported_count} reports.",
        "errors": errors
    }), 200

@app.route("/reports/fetch-external", methods=['POST'])
def fetch_external_reports():
    """
    Endpoint to fetch reports from a user-provided external API.
    """
    data = request.get_json()
    api_endpoint = data.get("apiEndpoint")
    api_key = data.get("apiKey")
    
    if not all([api_endpoint, api_key]):
        return jsonify({"error": "Missing API endpoint or key in request"}), 400

    try:
        # Headers for authorization and content type
        headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        
        # Make the actual request to the external API
        response = requests.get(api_endpoint, headers=headers)
        
        # Raise an exception for bad status codes (4xx or 5xx)
        response.raise_for_status()
        
        # Parse the JSON response
        external_reports = response.json().get('reports', [])

        # Insert the fetched reports into our local database
        count = insert_reports_to_db(external_reports)

        return jsonify({"message": f"Successfully fetched and imported {count} reports from external API."}), 200

    except requests.exceptions.RequestException as e:
        # Handle errors related to the external API call (e.g., network issues, invalid URL)
        return jsonify({"error": f"Failed to connect to external API: {str(e)}"}), 502
    except (KeyError, ValueError) as e:
        # Handle errors if the external API's response format is unexpected
        return jsonify({"error": f"Invalid data format from external API: {str(e)}"}), 422


if __name__ == '__main__':
    setup_database()
    app.run(debug=True)
