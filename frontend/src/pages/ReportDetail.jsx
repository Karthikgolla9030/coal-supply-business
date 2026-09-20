import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBusinessReport, downloadBusinessReport } from '../api/reports';
import { getCustomers } from '../api/customers';
import { getSuppliers } from '../api/suppliers';
import { ArrowLeft, Download, FileText, Search, Printer, FileSpreadsheet } from 'lucide-react';
import EmptyState from '../components/EmptyState';

const REPORT_TYPES = {
  'purchase': 'Purchase Report',
  'sales': 'Sales Report',
  'stock': 'Stock Report',
  'expense': 'Expense Report',
  'customer': 'Customer Report',
  'supplier': 'Supplier Report'
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amount || 0);
};

export default function ReportDetail() {
  const { type } = useParams();
  const navigate = useNavigate();
  const reportType = REPORT_TYPES[type];

  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [partyId, setPartyId] = useState('');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDesc, setSortDesc] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [parties, setParties] = useState([]);

  // Load parties for dropdowns
  useEffect(() => {
    if (type === 'purchase' || type === 'supplier') {
      getSuppliers({ no_page: true }).then(res => setParties(res.data.results || res.data)).catch(console.error);
    } else if (type === 'sales' || type === 'customer') {
      getCustomers({ no_page: true }).then(res => setParties(res.data.results || res.data)).catch(console.error);
    }
  }, [type]);

  const fetchReport = useCallback(() => {
    if (!reportType) return;
    setLoading(true);
    setError(null);

    let params = { type: reportType };
    const today = new Date();
    
    if (dateRange === 'Today') {
      const d = today.toISOString().split('T')[0];
      params.start_date = d; params.end_date = d;
    } else if (dateRange === 'This Week') {
      const first = today.getDate() - today.getDay();
      params.start_date = new Date(today.setDate(first)).toISOString().split('T')[0];
      params.end_date = new Date(today.setDate(first + 6)).toISOString().split('T')[0];
    } else if (dateRange === 'This Month') {
      params.start_date = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      params.end_date = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (dateRange === 'Last Month') {
      params.start_date = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      params.end_date = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
    } else if (dateRange === 'This Quarter') {
      const quarter = Math.floor(today.getMonth() / 3);
      params.start_date = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
      params.end_date = new Date(today.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
    } else if (dateRange === 'This Year') {
      params.start_date = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      params.end_date = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
    } else if (dateRange === 'Custom Range') {
      if (customStart && customEnd) {
        params.start_date = customStart; params.end_date = customEnd;
      }
    }
    
    if (partyId) {
      params.party_id = partyId;
    }

    getBusinessReport(params)
      .then(res => {
        setData(res.data);
        // Reset sorting when data changes
        setSortCol(null);
        setSortDesc(false);
      })
      .catch(() => setError("Unable to load report. Please try again."))
      .finally(() => setLoading(false));
  }, [reportType, dateRange, customStart, customEnd, partyId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (format) => {
    try {
      let params = { type: reportType, format };
      // Map current params
      const today = new Date();
      if (dateRange === 'Today') {
        const d = today.toISOString().split('T')[0];
        params.start_date = d; params.end_date = d;
      } else if (dateRange === 'This Week') {
        const first = today.getDate() - today.getDay();
        params.start_date = new Date(today.setDate(first)).toISOString().split('T')[0];
        params.end_date = new Date(today.setDate(first + 6)).toISOString().split('T')[0];
      } else if (dateRange === 'This Month') {
        params.start_date = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        params.end_date = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (dateRange === 'Last Month') {
        params.start_date = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
        params.end_date = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
      } else if (dateRange === 'This Quarter') {
        const quarter = Math.floor(today.getMonth() / 3);
        params.start_date = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        params.end_date = new Date(today.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
      } else if (dateRange === 'This Year') {
        params.start_date = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        params.end_date = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
      } else if (dateRange === 'Custom Range') {
        if (customStart && customEnd) {
          params.start_date = customStart; params.end_date = customEnd;
        }
      }
      
      if (partyId) params.party_id = partyId;

      const res = await downloadBusinessReport(params);
      
      const contentDisposition = res.headers['content-disposition'];
      let filename = `${reportType.replace(' ', '_')}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export report.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSort = (key) => {
    if (sortCol === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(key);
      setSortDesc(false);
    }
  };

  // Local filtering (Search) and Sorting
  const processedRows = useMemo(() => {
    if (!data?.rows) return [];
    
    let filtered = data.rows;
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(row => {
        return Object.values(row).some(val => 
          String(val).toLowerCase().includes(lowerSearch)
        );
      });
    }

    if (sortCol) {
      filtered = [...filtered].sort((a, b) => {
        let valA = a[sortCol];
        let valB = b[sortCol];
        
        // Handle numeric parsing if possible (e.g. "+100 MT")
        let numA = parseFloat(String(valA).replace(/[^0-9.-]+/g,""));
        let numB = parseFloat(String(valB).replace(/[^0-9.-]+/g,""));
        
        if (!isNaN(numA) && !isNaN(numB) && String(valA).includes(numA)) {
            valA = numA;
            valB = numB;
        }

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
    }

    return filtered;
  }, [data, search, sortCol, sortDesc]);

  if (!reportType) return <div className="page-content">Invalid report type.</div>;

  return (
    <div className="page-content">
      <div className="no-print">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reports')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Back to Reports
        </button>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{reportType}</h1>
          <p className="page-subtitle no-print">{data ? `Period: ${data.period}` : 'Select criteria to generate report.'}</p>
        </div>

        {/* Toolbar */}
        <div className="no-print" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-input" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ width: 'auto' }}>
            <option>All Time</option>
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
            <option>Last Month</option>
            <option>This Quarter</option>
            <option>This Year</option>
            <option>Custom Range</option>
          </select>
          {dateRange === 'Custom Range' && (
            <>
              <input type="date" className="form-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>to</span>
              <input type="date" className="form-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </>
          )}

          {(type === 'purchase' || type === 'sales') && (
            <select className="form-input" value={partyId} onChange={e => setPartyId(e.target.value)} style={{ width: 'auto' }}>
              <option value="">{type === 'purchase' ? 'All Suppliers' : 'All Customers'}</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <button className="btn btn-secondary" onClick={() => handleExport('pdf')} disabled={!data || data.rows.length === 0}>
            <FileText size={16} /> Export PDF
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('csv')} disabled={!data || data.rows.length === 0}>
            <FileSpreadsheet size={16} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={handlePrint} disabled={!data}>
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error no-print">{error}</div>}

      {loading ? (
        <div className="loading-state no-print"><div className="spinner" style={{ margin: '0 auto var(--space-3)' }} /> Loading {reportType}...</div>
      ) : data && (
        <>
          {/* Summary Box */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div className="card-title" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Report Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {Object.entries(data.summary).map(([key, val], i) => {
                let displayVal = val;
                if (typeof val === 'string' && val.match(/^[0-9.]+$/)) {
                  displayVal = formatCurrency(val);
                } else if (typeof val === 'number') {
                  displayVal = formatCurrency(val);
                }
                
                return (
                  <div key={i}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>{key}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{displayVal}</div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <div className="search-bar" style={{ width: '300px' }}>
              <span className="search-bar-icon"><Search size={16} /></span>
              <input
                className="form-input"
                type="text"
                placeholder="Search within report..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          {processedRows.length === 0 ? (
            <EmptyState
              icon={<Search size={48} />}
              title="NO DATA FOUND"
              message="No records match the selected filters. Try changing the date range or search terms."
            />
          ) : (
            <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
              <table style={{ margin: 0 }}>
                <thead>
                  <tr>
                    {Object.keys(processedRows[0]).filter(k => !k.startsWith('_')).map(key => (
                      <th key={key} onClick={() => handleSort(key)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        {key} {sortCol === key ? (sortDesc ? '↓' : '↑') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processedRows.map((row, i) => (
                    <tr key={i}>
                      {Object.entries(row).filter(([k, _]) => !k.startsWith('_')).map(([k, val], j) => {
                        let displayVal = val;
                        let isCurrency = false;
                        if (typeof val === 'string' && val.match(/^[0-9.]+$/)) {
                          displayVal = formatCurrency(val);
                          isCurrency = true;
                        } else if (typeof val === 'number') {
                          displayVal = formatCurrency(val);
                          isCurrency = true;
                        }
                        
                        return (
                          <td key={j} style={{ textAlign: isCurrency ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
