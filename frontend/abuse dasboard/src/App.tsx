import { useState, useEffect, useRef, useMemo } from 'react';

// Interfaces for data structures
interface Report {
  id: number;
  domain_name: string;
  abuse_type: string;
  report_source: string;
  confidence_score: number;
  status: string;
  risk_score: number;
  reviewer_id: string | null;
  last_updated: string;
}

interface SortConfig {
  key: keyof Report | null;
  direction: 'asc' | 'desc';
}

interface Message {
  text: string;
  type: 'success' | 'error';
}

interface HistoryModalState {
  visible: boolean;
  domain: string;
  history: Report[];
}

interface ReportFormData {
  domain_name: string;
  abuse_type: string;
  report_source: string;
  confidence_score: number;
}

// Function to trigger the backend API call with a specific configuration
async function fetchExternalReports(apiEndpoint: string, apiKey: string) {
    const API_BASE_URL = 'http://127.0.0.1:5000';
    try {
        const response = await fetch(`${API_BASE_URL}/reports/fetch-external`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiEndpoint,
                apiKey,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch external reports.');
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error("Error fetching external reports:", error);
        throw error;
    }
}

// Root App component
export default function App() {
  const [reports, setReports] = useState<Report[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [message, setMessage] = useState<Message | null>(null);
  const [historyModal, setHistoryModal] = useState<HistoryModalState>({ visible: false, domain: '', history: [] });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterRiskScore, setFilterRiskScore] = useState<string | null>(null);


  const API_BASE_URL = 'http://127.0.0.1:5000'; // Update this if your backend is on a different address

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports`);
      if (!response.ok) {
        throw new Error('Failed to fetch reports.');
      }
      const data: Report[] = await response.json();
      setReports(data);
    } catch (error) {
      if (error instanceof Error) {
        showMessage(`Error: ${error.message}`, 'error');
      }
    }
  };

  const handleFetchExternalReports = async (apiEndpoint: string, apiKey: string) => {
    if (!apiEndpoint || !apiKey) {
      showMessage('Please provide both an API endpoint and a key.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      await fetchExternalReports(apiEndpoint, apiKey);
      showMessage('External reports fetched successfully!', 'success');
      fetchReports(); // Refresh the main report list
    } catch (error) {
      if (error instanceof Error) {
        showMessage(`Error: ${error.message}`, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key: keyof Report) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const updateStatus = async (id: number, status: string, reviewer_id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewer_id }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update report ${id}.`);
      }
      fetchReports();
      showMessage(`Report ${id} status updated to ${status}.`);
    } catch (error) {
      if (error instanceof Error) {
        showMessage(`Error: ${error.message}`, 'error');
      }
    }
  };

  const showDomainHistory = async (domain: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/${domain}`);
      if (!response.ok) {
        throw new Error('No history found for this domain.');
      }
      const historyData: Report[] = await response.json();
      setHistoryModal({ visible: true, domain, history: historyData });
    } catch (error) {
      if (error instanceof Error) {
        showMessage(`Error: ${error.message}`, 'error');
      }
    }
  };

  // Effect to fetch initial data
  useEffect(() => {
    fetchReports();
  }, []);

  // Use useMemo to filter and sort reports, optimizing performance
  const filteredAndSortedReports = useMemo(() => {
    let filtered = reports;
    if (filterStatus) {
      filtered = filtered.filter(report => report.status === filterStatus);
    }
    if (filterRiskScore) {
      filtered = filtered.filter(report =>
        filterRiskScore === 'high' ? report.risk_score === 100 : report.risk_score !== 100
      );
    }

    if (!sortConfig.key) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (aValue === null || bValue === null) {
        return 0;
      }
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [reports, sortConfig, filterStatus, filterRiskScore]);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto bg-white p-6 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-indigo-600">Abuse Reports Dashboard</h1>
        <p className="text-gray-600 text-center mb-8">Review and manage reported domains. Flagged domains have a risk score of 100.</p>

        {message && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 ease-in-out ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {message.text}
          </div>
        )}

        <ReportForm API_BASE_URL={API_BASE_URL} fetchReports={fetchReports} showMessage={showMessage} />
        <BatchImportForm API_BASE_URL={API_BASE_URL} fetchReports={fetchReports} showMessage={showMessage} />
        <ExternalApiIntegration handleFetchExternalReports={handleFetchExternalReports} isLoading={isLoading} />
        <StatusTiles reports={reports} onFilterChange={setFilterStatus} activeFilter={filterStatus} />
        <RiskScoreTiles reports={reports} onFilterChange={setFilterRiskScore} activeFilter={filterRiskScore} />
        <ReportsTable reports={filteredAndSortedReports} updateStatus={updateStatus} showDomainHistory={showDomainHistory} handleSort={handleSort} sortConfig={sortConfig} totalReports={reports.length} />
        <DomainHistoryModal modal={historyModal} setModal={setHistoryModal} />
      </div>
    </div>
  );
}

// Sub-component for the form
interface ReportFormProps {
  API_BASE_URL: string;
  fetchReports: () => void;
  showMessage: (text: string, type?: 'success' | 'error') => void;
}

function ReportForm({ API_BASE_URL, fetchReports, showMessage }: ReportFormProps) {
  const [formData, setFormData] = useState<ReportFormData>({
    domain_name: '',
    abuse_type: 'Phishing',
    report_source: '',
    confidence_score: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, confidence_score: parseInt(formData.confidence_score.toString(), 10) }),
      });
      if (!response.ok) {
        throw new Error('Failed to submit report.');
      }
      setFormData({
        domain_name: '',
        abuse_type: 'Phishing',
        report_source: '',
        confidence_score: 0,
      });
      fetchReports();
      showMessage('New report submitted successfully!');
    } catch (error) {
      if (error instanceof Error) {
        showMessage(`Error: ${error.message}`, 'error');
      }
    }
  };

  return (
    <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Submit a New Report</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label htmlFor="domain_name" className="block text-sm font-medium text-gray-700">Domain Name</label>
          <input type="text" id="domain_name" value={formData.domain_name} onChange={handleChange} required pattern="[a-zA-Z0-9-]+\.[a-zA-Z]{2,}" title="e.g., example.com" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="abuse_type" className="block text-sm font-medium text-gray-700">Abuse Type</label>
          <select id="abuse_type" value={formData.abuse_type} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="Phishing">Phishing</option>
            <option value="Malware">Malware</option>
            <option value="Spam">Spam</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="report_source" className="block text-sm font-medium text-gray-700">Reporting Source</label>
          <input type="text" id="report_source" value={formData.report_source} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="confidence_score" className="block text-sm font-medium text-gray-700">Confidence Score (0-100)</label>
          <input type="number" id="confidence_score" value={formData.confidence_score} onChange={handleChange} min="0" max="100" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div className="md:col-span-4">
          <button type="submit" className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out">
            Submit Report
          </button>
        </div>
      </form>
    </div>
  );
}

// Sub-component for batch importing reports
interface BatchImportFormProps {
  API_BASE_URL: string;
  fetchReports: () => void;
  showMessage: (text: string, type?: 'success' | 'error') => void;
}

function BatchImportForm({ API_BASE_URL, fetchReports, showMessage }: BatchImportFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showMessage("Please select a file to upload.", "error");
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/reports/batch-import`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import reports.');
      }

      const result = await response.json();
      showMessage(result.message, "success");
      fetchReports();

      // Clear the file input
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      if (error instanceof Error) {
        showMessage(`Error: ${error.message}`, 'error');
      }
    }
  };

  return (
    <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Batch Import Reports (CSV)</h2>
      <div className="flex flex-col md:flex-row items-center gap-4">
        <label className="block text-sm font-medium text-gray-700 w-full md:w-auto">Choose CSV File:</label>
        <input ref={fileInputRef} type="file" onChange={handleFileChange} accept=".csv" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
        <button onClick={handleUpload} disabled={!selectedFile} className="w-full md:w-auto py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 transition duration-150 ease-in-out">
          Upload
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        The CSV file should contain the columns: `domain_name`, `abuse_type`, `report_source`, and `confidence_score`.
      </p>
    </div>
  );
}

interface ExternalApiIntegrationProps {
  handleFetchExternalReports: (apiEndpoint: string, apiKey: string) => void;
  isLoading: boolean;
}

function ExternalApiIntegration({ handleFetchExternalReports, isLoading }: ExternalApiIntegrationProps) {
    const [apiEndpoint, setApiEndpoint] = useState<string>('');
    const [apiKey, setApiKey] = useState<string>('');

    const handleFetch = () => {
        handleFetchExternalReports(apiEndpoint, apiKey);
        setApiEndpoint('');
        setApiKey('');
    };

    return (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Fetch Reports from External API</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                    <label htmlFor="api-endpoint" className="block text-sm font-medium text-gray-700">API Endpoint</label>
                    <input
                        type="text"
                        id="api-endpoint"
                        value={apiEndpoint}
                        onChange={(e) => setApiEndpoint(e.target.value)}
                        placeholder="e.g., https://api.threatintel.com/reports"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">API Key</label>
                    <input
                        type="password"
                        id="api-key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="e.g., sk-xxxxxxxxxxxx"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <button
                    onClick={handleFetch}
                    disabled={isLoading || !apiEndpoint || !apiKey}
                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 transition duration-150 ease-in-out"
                >
                    {isLoading ? 'Fetching Reports...' : 'Fetch External Reports'}
                </button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
                Enter the API endpoint and key to fetch reports on-demand.
            </p>
        </div>
    );
}

interface ReportsTableProps {
  reports: Report[];
  updateStatus: (id: number, status: string, reviewer_id: string) => void;
  showDomainHistory: (domain: string) => void;
  handleSort: (key: keyof Report) => void;
  sortConfig: SortConfig;
  totalReports: number;
}

function ReportsTable({ reports, updateStatus, showDomainHistory, handleSort, sortConfig, totalReports }: ReportsTableProps) {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'New': return 'bg-blue-200 text-blue-800';
      case 'Reviewed': return 'bg-green-200 text-green-800';
      case 'Escalated': return 'bg-yellow-200 text-yellow-800';
      case 'Suspended': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Abuse Reports</h2>
      <div id="reports-table-container" className="overflow-y-scroll h-[60vh] bg-white rounded-lg shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <TableHeader sortKey="domain_name" currentSort={sortConfig} onSort={handleSort}>Domain Name</TableHeader>
              <TableHeader sortKey="abuse_type" currentSort={sortConfig} onSort={handleSort}>Abuse Type</TableHeader>
              <TableHeader sortKey="report_source" currentSort={sortConfig} onSort={handleSort}>Source</TableHeader>
              <TableHeader sortKey="confidence_score" currentSort={sortConfig} onSort={handleSort}>Confidence Score</TableHeader>
              <TableHeader sortKey="risk_score" currentSort={sortConfig} onSort={handleSort}>Risk Score</TableHeader>
              <TableHeader sortKey="status" currentSort={sortConfig} onSort={handleSort}>Status</TableHeader>
              <TableHeader sortKey="last_updated" currentSort={sortConfig} onSort={handleSort}>Last Updated</TableHeader>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.length > 0 ? (
              reports.map((report) => (
                <tr key={report.id} className={report.risk_score === 100 ? 'bg-red-100' : 'bg-white'}>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button onClick={() => showDomainHistory(report.domain_name)} className="text-indigo-600 hover:text-indigo-900 font-bold">
                      {report.domain_name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.abuse_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.report_source}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.confidence_score}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${report.risk_score === 100 ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                      {report.risk_score === 100 ? 'High Risk' : 'Standard'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(report.last_updated).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => updateStatus(report.id, 'Reviewed', 'Admin')} className="text-indigo-600 hover:text-indigo-900 mr-2">Review</button>
                    <button onClick={() => updateStatus(report.id, 'Escalated', 'Admin')} className="text-yellow-600 hover:text-yellow-900 mr-2">Escalate</button>
                    <button onClick={() => updateStatus(report.id, 'Suspended', 'Admin')} className="text-red-600 hover:text-red-900">Suspend</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-gray-500">No reports found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-4 text-center bg-gray-50 rounded-lg shadow-inner">
        <span className="text-sm font-semibold text-gray-700">Total Reports: {totalReports}</span>
      </div>
    </div>
  );
}

// Sub-component for sortable table headers
interface TableHeaderProps {
  children: React.ReactNode;
  sortKey: keyof Report;
  currentSort: SortConfig;
  onSort: (key: keyof Report) => void;
}

function TableHeader({ children, sortKey, currentSort, onSort }: TableHeaderProps) {
  const isSorted = currentSort.key === sortKey;
  const directionIcon = isSorted ? (currentSort.direction === 'asc' ? '▲' : '▼') : '';
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
      onClick={() => onSort(sortKey)}
    >
      {children}
      <span className="ml-1">{directionIcon}</span>
    </th>
  );
}

// Sub-component for the domain history modal
interface DomainHistoryModalProps {
  modal: HistoryModalState;
  setModal: React.Dispatch<React.SetStateAction<HistoryModalState>>;
}

function DomainHistoryModal({ modal, setModal }: DomainHistoryModalProps) {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'New': return 'bg-blue-200 text-blue-800';
      case 'Reviewed': return 'bg-green-200 text-green-800';
      case 'Escalated': return 'bg-yellow-200 text-yellow-800';
      case 'Suspended': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  if (!modal.visible) return null;

  return (
    <div className="modal" style={{ display: modal.visible ? 'block' : 'none' }}>
      <div className="modal-content">
        <span className="close-button" onClick={() => setModal({ ...modal, visible: false })}>&times;</span>
        <h2 className="text-2xl font-bold mb-4">Report History for {modal.domain}</h2>
        <div id="historyContent" className="overflow-x-auto">
          {modal.history.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abuse Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence Score</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {modal.history.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`${getStatusColor(report.status)} px-2 rounded-full text-xs font-semibold`}>{report.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(report.last_updated).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-now-word text-sm text-gray-500">{report.abuse_type}</td>
                    <td className="px-6 py-4 whitespace-now-word text-sm text-gray-500">{report.confidence_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-center">No history available for this domain.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// New sub-component for the status tiles
interface StatusTilesProps {
  reports: Report[];
  onFilterChange: (status: string | null) => void;
  activeFilter: string | null;
}

function StatusTiles({ reports, onFilterChange, activeFilter }: StatusTilesProps) {
  const statusCounts = reports.reduce((counts, report) => {
    counts[report.status] = (counts[report.status] || 0) + 1;
    return counts;
  }, {} as { [key: string]: number });

  const totalCount = reports.length;

  const tiles = [
    { title: 'All', status: null, count: totalCount, color: 'bg-gray-100' },
    { title: 'New', status: 'New', count: statusCounts['New'] || 0, color: 'bg-blue-100' },
    { title: 'Reviewed', status: 'Reviewed', count: statusCounts['Reviewed'] || 0, color: 'bg-green-100' },
    { title: 'Escalated', status: 'Escalated', count: statusCounts['Escalated'] || 0, color: 'bg-yellow-100' },
    { title: 'Suspended', status: 'Suspended', count: statusCounts['Suspended'] || 0, color: 'bg-red-100' },
  ];

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2 text-gray-800">Filter by Status</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {tiles.map((tile) => (
          <div
            key={tile.title}
            onClick={() => onFilterChange(tile.status)}
            className={`cursor-pointer p-5 rounded-xl border-2 shadow-sm transition-all duration-200 transform hover:scale-105 ${tile.color} ${activeFilter === tile.status || (activeFilter === null && tile.status === null) ? 'ring-4 ring-indigo-500' : ''}`}
          >
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-gray-900">{tile.count}</span>
              <h3 className="text-lg font-semibold text-gray-700 mt-2">{tile.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// New component for risk score tiles
interface RiskScoreTilesProps {
  reports: Report[];
  onFilterChange: (riskScore: string | null) => void;
  activeFilter: string | null;
}

function RiskScoreTiles({ reports, onFilterChange, activeFilter }: RiskScoreTilesProps) {
  const highRiskCount = reports.filter(r => r.risk_score === 100).length;
  const standardRiskCount = reports.filter(r => r.risk_score !== 100).length;

  const tiles = [
    { title: 'High Risk', riskScore: 'high', count: highRiskCount, color: 'bg-red-100' },
    { title: 'Standard', riskScore: 'standard', count: standardRiskCount, color: 'bg-green-100' },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2 text-gray-800">Filter by Risk Score</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <div
            key={tile.title}
            onClick={() => onFilterChange(tile.riskScore)}
            className={`cursor-pointer p-5 rounded-xl border-2 shadow-sm transition-all duration-200 transform hover:scale-105 ${tile.color} ${activeFilter === tile.riskScore || (activeFilter === null && tile.riskScore === null) ? 'ring-4 ring-indigo-500' : ''}`}
          >
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-gray-900">{tile.count}</span>
              <h3 className="text-lg font-semibold text-gray-700 mt-2">{tile.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
}
