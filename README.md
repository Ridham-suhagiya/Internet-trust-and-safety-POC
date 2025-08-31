Domain Abuse Mitigation Backend
===============================

This project is a Flask-based API for a domain abuse mitigation system. It provides a robust set of endpoints for creating, retrieving, and managing abuse reports, including features for batch import and automated risk scoring.

Features
--------

-   **Report Management**: Create, view, and update individual abuse reports.

-   **Automated Risk Scoring**: A simple business logic function automatically calculates a risk score for each report based on its type, confidence, and domain keywords.

-   **Batch Import**: Import multiple reports at once from a CSV file.

-   **External Data Integration**: Fetch and import reports from an external API endpoint.

-   **PostgreSQL Database**: Persistent storage of all abuse report data.

Setup Instructions
------------------

### Prerequisites

You will need the following installed on your system:

-   **Python 3.8+**

-   **PostgreSQL**

### 1\. Clone the Repository

Clone this project to your local machine:

```
git clone [https://github.com/your-username/your-project-repo.git](https://github.com/your-username/your-project-repo.git)
cd your-project-repo

```

### 2\. Set up the Python Environment

It's highly recommended to use a virtual environment.

```
python -m venv venv
source venv/bin/activate
pip install Flask psycopg2-binary requests

```

### 3\. Database Configuration

The application connects to a PostgreSQL database. You need to set the following environment variables with your database credentials.

```
export PG_DATABASE='abuse_db'
export PG_USER='postgres'
export PG_PASSWORD='your_password'
export PG_HOST='localhost'

```

### 4\. Run the Application

Navigate to the project directory and run the Flask application. The `setup_database()` function will automatically create the `reports` table if it doesn't already exist.

```
python app.py

```

The API will now be running at `http://localhost:5000`.

API Endpoints
-------------

### `GET /`

**Description**: A simple health check to confirm the API is running. **Response**:

```
{
    "message": "API is running."
}

```

### `POST /reports`

**Description**: Creates a new abuse report. **Request Body**:

```
{
    "domain_name": "phishing-site.com",
    "report_source": "abuse-desk-report",
    "abuse_type": "Phishing",
    "confidence_score": 90
}

```

**Response**:

```
{
    "message": "Report created successfully.",
    "id": 1
}

```

### `GET /reports`

**Description**: Retrieves a list of all reports in the database. **Response**:

```
[
    {
        "id": 1,
        "domain_name": "phishing-site.com",
        "abuse_type": "Phishing",
        "report_source": "abuse-desk-report",
        "confidence_score": 90,
        "status": "New",
        "risk_score": 100,
        "reviewer_id": null,
        "last_updated": "2023-10-27T10:00:00Z"
    }
]

```

### `PUT /reports/<int:report_id>`

**Description**: Updates the status and reviewer for a specific report. **Request Body**:

```
{
    "status": "In Progress",
    "reviewer_id": "john.doe"
}

```

**Response**:

```
{
    "message": "Report 1 updated successfully."
}

```

### `POST /reports/batch-import`

**Description**: Imports reports from an uploaded CSV file. **Form Data**: `file` (a CSV file) **CSV Format**:

```
domain_name,abuse_type,report_source,confidence_score
example-spam.net,Spam,csv-upload,65
malware-threat.net,Malware,csv-upload,98

```

**Response**:

```
{
    "message": "Successfully imported 2 reports.",
    "errors": []
}

```

### `POST /reports/fetch-external`

**Description**: Fetches reports from an external API and imports them into the database. **Request Body**:

```
{
    "apiEndpoint": "[https://api.external.com/reports](https://api.external.com/reports)",
    "apiKey": "your_api_key"
}

```

**Response**:

```
{
    "message": "Successfully fetched and imported 5 reports from external API."
}

```

Business Logic and Reasoning
----------------------------

The core business logic is encapsulated in the `determine_risk_level` function, which is used to automatically assign a **risk score** to each new report. The logic is as follows:

-   **High Risk (Score: 100)**: A report is considered high-risk if any of the following conditions are met:

    -   The `confidence_score` is greater than 80.

    -   The `abuse_type` is 'Phishing' or 'Malware'.

    -   The `domain_name` contains suspicious keywords like `'paypal'`, `'login'`, or `'bank'`.

-   **Standard Risk (Score: 50)**: If none of the above conditions are met, the report is assigned a standard risk score.

Testing
-------

A comprehensive unit test suite is provided to ensure all API endpoints and the risk scoring logic work as expected. These tests use **mocking** to simulate database and external API interactions, meaning you can run them without a live PostgreSQL server.

To run the tests, use the following command from the project root:

```
python -m unittest test_app.py

```