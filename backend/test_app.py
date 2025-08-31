import unittest
import json
import io
from unittest.mock import patch, MagicMock
from app import app, setup_database, determine_risk_level
import requests

class TestApp(unittest.TestCase):

    def setUp(self):
        """
        Set up the Flask test client and mock the PostgreSQL connection before each test.
        """
        # Set up a test client
        self.app = app.test_client()
        self.app.testing = True

        # Mock the psycopg2 connection and cursor
        # This prevents the tests from connecting to a real database
        self.mock_conn = MagicMock()
        self.mock_cursor = MagicMock()
        
        # Patch the get_db_connection function to return our mock connection
        self.db_patcher = patch('app.get_db_connection', return_value=self.mock_conn)
        self.db_patcher.start()

        # Mock the cursor's execute and fetchone methods
        self.mock_conn.cursor.return_value = self.mock_cursor

    def tearDown(self):
        """
        Clean up resources after each test.
        """
        # Stop the patcher to un-mock the database connection
        self.db_patcher.stop()

    def test_home_endpoint(self):
        """Test the home endpoint to ensure the API is running."""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('API is running', data['message'])

    def test_determine_risk_level(self):
        """Test the business logic for determining risk level."""
        # High risk due to confidence score
        self.assertEqual(determine_risk_level('Spam', 90, 'example.com'), 100)
        # High risk due to abuse type
        self.assertEqual(determine_risk_level('Phishing', 50, 'example.com'), 100)
        self.assertEqual(determine_risk_level('Malware', 50, 'example.com'), 100)
        # High risk due to suspicious keyword in domain name
        self.assertEqual(determine_risk_level('Spam', 50, 'verify-bank.com'), 100)
        # Standard risk
        self.assertEqual(determine_risk_level('Spam', 50, 'safedomain.com'), 50)

    def test_create_report_success(self):
        """Test creating a new report with valid data."""
        report_data = {
            "domain_name": "test.com",
            "report_source": "Test",
            "abuse_type": "Spam",
            "confidence_score": 75
        }
        
        # Mock the fetchone call to return a new ID
        self.mock_cursor.fetchone.return_value = (1,)
        
        response = self.app.post('/reports', 
                                 data=json.dumps(report_data),
                                 content_type='application/json')
                                 
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertIn('Report created successfully', data['message'])
        self.assertEqual(data['id'], 1)
        
        # Verify that the database execute and commit were called once
        self.mock_cursor.execute.assert_called_once()
        self.mock_conn.commit.assert_called_once()


    def test_get_reports_success(self):
        """Test retrieving all reports."""
        mock_reports = [
            {'id': 1, 'domain_name': 'example.com', 'status': 'New'},
            {'id': 2, 'domain_name': 'test.net', 'status': 'Reviewed'}
        ]
        
        # Mock the database cursor to return a list of dictionaries
        self.mock_cursor.fetchall.return_value = mock_reports
        
        response = self.app.get('/reports')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['domain_name'], 'example.com')
    
    def test_get_report_by_domain_success(self):
        """Test retrieving a report by domain name."""
        mock_history = [
            {'id': 1, 'domain_name': 'example.com', 'status': 'New'},
            {'id': 2, 'domain_name': 'example.com', 'status': 'Reviewed'}
        ]
        
        self.mock_cursor.fetchall.return_value = mock_history
        
        response = self.app.get('/reports/example.com')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['domain_name'], 'example.com')

    def test_get_report_by_domain_not_found(self):
        """Test retrieving history for a domain that does not exist."""
        self.mock_cursor.fetchall.return_value = []
        
        response = self.app.get('/reports/nonexistent.com')
        
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertIn('No reports found', data['error'])
        
    def test_update_report_status_success(self):
        """Test updating a report's status."""
        update_data = {
            "status": "Escalated",
            "reviewer_id": "reviewer-123"
        }
        
        # Mock the cursor's fetchone to simulate that the report exists
        self.mock_cursor.fetchone.return_value = (1,)
        
        response = self.app.put('/reports/1', 
                                data=json.dumps(update_data),
                                content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('updated successfully', data['message'])
        
    def test_update_report_status_not_found(self):
        """Test updating a report that does not exist."""
        update_data = {
            "status": "Escalated",
            "reviewer_id": "reviewer-123"
        }
        
        # Mock the cursor's fetchone to simulate that the report does not exist
        self.mock_cursor.fetchone.return_value = None
        
        response = self.app.put('/reports/999', 
                                data=json.dumps(update_data),
                                content_type='application/json')
        
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertIn('Report not found', data['error'])

    @patch('app.insert_reports_to_db')
    def test_batch_import_success(self, mock_insert_reports):
        """Test successful CSV batch import."""
        mock_insert_reports.return_value = 2
        
        csv_data = "domain_name,abuse_type,report_source,confidence_score\nphishing.com,Phishing,csv_import,95\nmalware.net,Malware,csv_import,100"
        
        response = self.app.post('/reports/batch-import', data={'file': (io.BytesIO(csv_data.encode()), 'test.csv')}, content_type='multipart/form-data')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('Successfully imported 2 reports', data['message'])

    def test_batch_import_invalid_file(self):
        """Test batch import with an invalid file type."""
        text_data = "this is not a csv"
        
        response = self.app.post('/reports/batch-import', data={'file': (io.BytesIO(text_data.encode()), 'test.txt')}, content_type='multipart/form-data')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('Invalid file type', data['error'])

    @patch('app.requests.get')
    @patch('app.insert_reports_to_db')
    def test_fetch_external_reports_success(self, mock_insert_reports, mock_get):
        """Test successful fetching and importing from an external API."""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "reports": [
                {"domain_name": "external-report-1.com", "abuse_type": "Spam", "report_source": "External", "confidence_score": 60},
                {"domain_name": "external-report-2.com", "abuse_type": "Phishing", "report_source": "External", "confidence_score": 90}
            ]
        }
        mock_insert_reports.return_value = 2

        response = self.app.post('/reports/fetch-external', 
                                 data=json.dumps({"apiEndpoint": "https://api.external.com/reports", "apiKey": "test-key"}), 
                                 content_type='application/json')

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('Successfully fetched and imported 2 reports', data['message'])
        mock_insert_reports.assert_called_once()
        mock_get.assert_called_once()

    @patch('app.requests.get', side_effect=requests.exceptions.RequestException)
    def test_fetch_external_reports_failure(self, mock_get):
        """Test failed connection to an external API."""
        response = self.app.post('/reports/fetch-external', 
                                 data=json.dumps({"apiEndpoint": "https://api.external.com/reports", "apiKey": "test-key"}), 
                                 content_type='application/json')

        self.assertEqual(response.status_code, 502)
        data = json.loads(response.data)
        self.assertIn('Failed to connect to external API', data['error'])


if __name__ == '__main__':
    # Initial setup for the database table (this runs only once before all tests)
    with patch('app.psycopg2.connect'):
        setup_database()
    unittest.main()
