import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getInvoices, downloadInvoicePdf } from '../api/invoices';
import { getCustomers } from '../api/customers';

export default function InvoiceList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);

  // Local state for search input to allow debouncing
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  // Fetch customers for the dropdown filter
  useEffect(() => {
    getCustomers()
      .then(res => setCustomers(res.data))
      .catch(err => console.error('Failed to load customers for filter', err));
  }, []);

  // Fetch invoices based on query params
  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      setError('');
      try {
        const params = Object.fromEntries(searchParams.entries());
        const response = await getInvoices(params);
        setInvoices(response.data.results);
        setCount(response.data.count);
      } catch (err) {
        setError('Unable to load invoices. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [searchParams]);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilter('search', searchInput);
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Update URL params
  const updateFilter = (key, value) => {
    const current = Object.fromEntries(searchParams.entries());
    if (value) {
      current[key] = value;
    } else {
      delete current[key];
    }
    
    // If anything other than page changes, reset page to 1
    if (key !== 'page') {
      delete current['page'];
    }
    
    setSearchParams(current);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const handlePageChange = (newPage) => {
    updateFilter('page', newPage.toString());
  };

  const handleDownloadPdf = async (id, invoiceNumber) => {
    try {
      const response = await downloadInvoicePdf(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      
      let filename = `Invoice-${invoiceNumber}.pdf`;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }
      
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Unable to generate the invoice PDF. Please try again.');
    }
  };

  // Pagination vars
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const pageSize = 20;
  const totalPages = Math.ceil(count / pageSize);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  // Determine empty states
  const hasFilters = searchParams.toString().length > 0;
  
  return (
    <div className="page-content" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Invoices</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/invoices/create')}
        >
          + New Invoice
        </button>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          
          {/* Search */}
          <div style={{ flex: '1 1 250px' }}>
            <label className="form-label">Search</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Invoice no, customer, GSTIN, vehicle..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* Customer Filter */}
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Customer</label>
            <select 
              className="form-control" 
              value={searchParams.get('customer') || ''}
              onChange={(e) => updateFilter('customer', e.target.value)}
            >
              <option value="">All Customers ▼</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Date From</label>
            <input 
              type="date" 
              className="form-control" 
              value={searchParams.get('date_from') || ''}
              onChange={(e) => updateFilter('date_from', e.target.value)}
            />
          </div>

          {/* Date To */}
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Date To</label>
            <input 
              type="date" 
              className="form-control" 
              value={searchParams.get('date_to') || ''}
              onChange={(e) => updateFilter('date_to', e.target.value)}
            />
          </div>

          {/* Transaction Type */}
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Transaction Type</label>
            <select 
              className="form-control"
              value={searchParams.get('transaction_type') || ''}
              onChange={(e) => updateFilter('transaction_type', e.target.value)}
            >
              <option value="">All ▼</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          {/* Clear Button */}
          <div style={{ flex: '0 0 auto' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleClearFilters}
              disabled={!hasFilters && searchInput === ''}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ textAlign: 'center', color: 'red', margin: '3rem 0' }}>
          <h4>Error</h4>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => updateFilter('retry', Date.now().toString())}>Try Again</button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', margin: '3rem 0' }}>
          <p>Loading invoices...</p>
        </div>
      ) : count === 0 ? (
        <div style={{ textAlign: 'center', margin: '4rem 0', backgroundColor: '#fff', padding: '3rem', borderRadius: '8px' }}>
          {hasFilters ? (
            <>
              <h4>No invoices found.</h4>
              <p>Try changing your search or filters.</p>
              <button className="btn btn-secondary mt-3" onClick={handleClearFilters}>Clear Filters</button>
            </>
          ) : (
            <>
              <h4>No invoices yet.</h4>
              <p>Create your first invoice to start keeping digital records.</p>
              <button className="btn btn-primary mt-3" onClick={() => navigate('/invoices/create')}>+ Create Invoice</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #edf2f7', backgroundColor: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '1rem' }}>Invoice</th>
                  <th style={{ padding: '1rem' }}>Date</th>
                  <th style={{ padding: '1rem' }}>Customer</th>
                  <th style={{ padding: '1rem' }}>Vehicle</th>
                  <th style={{ padding: '1rem' }}>Type</th>
                  <th style={{ padding: '1rem' }}>Total</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Drive</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '1rem' }}><strong>{inv.invoice_number}</strong></td>
                    <td style={{ padding: '1rem' }}>
                      {new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td style={{ padding: '1rem' }}>{inv.customer?.name || 'Unknown Customer'}</td>
                    <td style={{ padding: '1rem' }}>{inv.vehicle_number || '-'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem',
                        backgroundColor: inv.transaction_type === 'CASH' ? '#c6f6d5' : '#bee3f8',
                        color: inv.transaction_type === 'CASH' ? '#22543d' : '#2a4365'
                      }}>
                        {inv.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>{formatAmount(inv.total_amount)}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {inv.google_drive_status === 'UPLOADED' ? (
                        <span title="Uploaded to Google Drive" style={{ color: '#38a169', fontSize: '1.2rem' }}>✓</span>
                      ) : inv.google_drive_status === 'FAILED' ? (
                        <span title="Upload Failed" style={{ color: '#e53e3e', fontSize: '1.2rem' }}>✗</span>
                      ) : (
                        <span title="Not Uploaded" style={{ color: '#a0aec0', fontSize: '1.2rem' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <Link to={`/invoices/${inv.id}`} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', marginRight: '0.5rem' }}>View</Link>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem' }}
                        onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <p style={{ color: '#718096' }}>
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, count)} of {count}
            </p>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button 
                className="btn btn-secondary" 
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </button>
              
              {/* Simple page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                // Show limited pages (current, first, last, surrounding)
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button 
                      key={pageNum}
                      className={pageNum === currentPage ? "btn btn-primary" : "btn btn-secondary"}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  pageNum === currentPage - 2 || 
                  pageNum === currentPage + 2
                ) {
                  return <span key={pageNum} style={{ padding: '0.5rem' }}>...</span>;
                }
                return null;
              })}

              <button 
                className="btn btn-secondary" 
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
