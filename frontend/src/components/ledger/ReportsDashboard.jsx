import React, { useState, useEffect } from 'react';
import { ledgerApi } from '../../api/ledger';
import * as customersApi from '../../api/customers'; // for customer list
import { FileText, Download, AlertCircle, RefreshCw } from 'lucide-react';

const REPORT_TYPES = [
  'Financial Summary',
  'Money to Receive',
  'Money to Pay',
  'Payment History',
  'Customer Ledger',
  'Transaction History'
];

const DATE_RANGES = [
  'All Time',
  'Today',
  'This Week',
  'This Month',
  'Last Month',
  'This Financial Year',
  'Custom Range'
];

export default function ReportsDashboard() {
  const [reportType, setReportType] = useState('Financial Summary');
  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [summary, setSummary] = useState({});
  const [rows, setRows] = useState([]);

  // Fetch customers for the dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await customersApi.getCustomers();
        const data = res.data || {};
        if (data.results) {
          setCustomers(data.results);
        } else {
          setCustomers(data);
        }
      } catch (err) {
        console.error("Failed to fetch customers", err);
      }
    };
    fetchCustomers();
  }, []);

  const calculateDateBounds = () => {
    const today = new Date();
    let start = null;
    let end = null;
    
    if (dateRange === 'Today') {
      start = new Date();
      end = new Date();
    } else if (dateRange === 'This Week') {
      start = new Date();
      start.setDate(today.getDate() - today.getDay()); // Sunday
      end = new Date();
    } else if (dateRange === 'This Month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (dateRange === 'Last Month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (dateRange === 'This Financial Year') {
      const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      start = new Date(year, 3, 1); // April 1st
      end = new Date(year + 1, 2, 31); // March 31st
    } else if (dateRange === 'Custom Range') {
      if (customStart) start = new Date(customStart);
      if (customEnd) end = new Date(customEnd);
    }
    
    // Format to YYYY-MM-DD
    const formatDate = (d) => d ? d.toISOString().split('T')[0] : null;
    return { start_date: formatDate(start), end_date: formatDate(end) };
  };

  const getFilters = () => {
    const { start_date, end_date } = calculateDateBounds();
    return {
      report_type: reportType,
      start_date,
      end_date,
      party_id: selectedCustomerId || null,
      payment_method: paymentMethod || null
    };
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ledgerApi.getReports(getFilters());
      const data = res.data || {};
      setSummary(data.summary || {});
      // Support paginated or unpaginated list
      if (data.rows && Array.isArray(data.rows)) {
        setRows(data.rows);
      } else if (data.rows && Array.isArray(data.rows.results)) {
        setRows(data.rows.results);
      } else {
        setRows([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  // Initially fetch the report
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (format) => {
    try {
      let req;
      if (format === 'pdf') req = ledgerApi.exportReportPdf(getFilters());
      else if (format === 'excel') req = ledgerApi.exportReportExcel(getFilters());
      else if (format === 'csv') req = ledgerApi.exportReportCsv(getFilters());
      
      const res = await req;
      // Download blob
      const url = window.URL.createObjectURL(new Blob([res]));
      const link = document.createElement('a');
      link.href = url;
      
      const ext = format === 'excel' ? 'xlsx' : format;
      const { start_date, end_date } = calculateDateBounds();
      const dateLabel = (start_date && end_date) ? `${start_date}_to_${end_date}` : 'All_Time';
      link.setAttribute('download', `${reportType.replace(/ /g, '_')}_${dateLabel}.${ext}`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setError(`Failed to export ${format.toUpperCase()}. Please try again.`);
    }
  };

  const formatMoney = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '₹0.00';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div>
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, paddingRight: '1rem', borderRight: '1px solid var(--color-border)' }}>
              <FileText size={18} /> Reports
            </h2>
            
            <select 
              className="form-control"
              style={{ width: 'auto', backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {REPORT_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
            </select>
            
            <select 
              className="form-control"
              style={{ width: 'auto', backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              {DATE_RANGES.map(dr => <option key={dr} value={dr}>{dr}</option>)}
            </select>

            <select 
              className="form-control"
              style={{ width: 'auto', maxWidth: '180px', backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">All Parties</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {reportType === 'Payment History' && (
              <select className="form-control" style={{ width: 'auto' }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            )}
          </div>

          <button className="btn btn-primary" onClick={fetchReport} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? <RefreshCw size={16} className="spin" /> : 'Generate'}
          </button>
        </div>

        {dateRange === 'Custom Range' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Custom Date Range:</span>
            <input type="date" className="form-control" style={{ width: 'auto' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>to</span>
            <input type="date" className="form-control" style={{ width: 'auto' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: '1 1 auto' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1.25rem', color: 'var(--color-text)' }}>REPORT SUMMARY</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>Money to Receive</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text)' }}>{formatMoney(summary.to_receive)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>Money to Pay</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text)' }}>{formatMoney(summary.to_pay)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>Payments Received</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-success)' }}>{formatMoney(summary.received)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>Payments Made</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-primary-light)' }}>{formatMoney(summary.paid)}</div>
              </div>
              <div style={{ paddingLeft: '1.5rem', borderLeft: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>Still to Receive</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-warning)' }}>{formatMoney(summary.current_outstanding_receive)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>Still to Pay</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-danger)' }}>{formatMoney(summary.current_outstanding_pay)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => handleExport('csv')} disabled={loading || (rows.length === 0 && reportType !== 'Financial Summary')}>
              CSV
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => handleExport('excel')} disabled={loading || (rows.length === 0 && reportType !== 'Financial Summary')}>
              Excel
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => handleExport('pdf')} disabled={loading || (rows.length === 0 && reportType !== 'Financial Summary')}>
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
        
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading report data...
          </div>
        ) : reportType === 'Financial Summary' ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Financial summary does not include itemized records. <br/> See summary above.
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No records found for the selected period and filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} style={{ padding: '0.75rem 1.5rem', fontWeight: '500' }}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.15s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {Object.entries(row).map(([key, val], j) => {
                      const isMoney = !isNaN(parseFloat(val)) && typeof val !== 'boolean' && key !== 'Date' && key !== 'Reference' && key !== 'Status' && key !== 'Invoice / Reference';
                      return (
                        <td key={j} style={{ padding: '1rem 1.5rem', textAlign: isMoney ? 'right' : 'left', color: 'var(--color-text)', fontWeight: isMoney ? '600' : '400' }}>
                          {isMoney ? formatMoney(val) : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
