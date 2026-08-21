import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getInvoices, downloadInvoicePdf } from '../api/invoices';
import { getCustomers } from '../api/customers';
import { Search, Plus, FilterX, Download, Eye, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import EmptyState from '../components/EmptyState';

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
      .then(res => setCustomers(res.data.results || res.data || []))
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
        setInvoices(response.data.results || response.data || []);
        setCount(response.data.count || (Array.isArray(response.data) ? response.data.length : 0));
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h1 className="page-title">Invoices</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/invoices/new')}
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          
          {/* Search */}
          <div style={{ flex: '1 1 250px' }}>
            <label className="form-label">Search</label>
            <div className="search-bar mt-2">
              <span className="search-bar-icon"><Search size={16} /></span>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Invoice no, customer..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          {/* Customer Filter */}
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Customer</label>
            <select 
              className="form-input mt-2" 
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
              className="form-input mt-2" 
              value={searchParams.get('date_from') || ''}
              onChange={(e) => updateFilter('date_from', e.target.value)}
            />
          </div>

          {/* Date To */}
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Date To</label>
            <input 
              type="date" 
              className="form-input mt-2" 
              value={searchParams.get('date_to') || ''}
              onChange={(e) => updateFilter('date_to', e.target.value)}
            />
          </div>

          {/* Transaction Type */}
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Transaction Type</label>
            <select 
              className="form-input mt-2"
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
              <FilterX size={16} /> Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-error">{error}</div>
      ) : loading ? (
        <div className="loading-state">
          <div className="spinner" style={{ margin: '0 auto var(--space-4)' }} />
          Loading invoices…
        </div>
      ) : count === 0 ? (
        <EmptyState
          icon={<FileText size={48} />}
          title={hasFilters ? "No invoices found" : "No invoices yet"}
          message={hasFilters ? "Try changing your search or filters." : "Create your first invoice to start keeping digital records."}
          action={
            hasFilters 
              ? <button className="btn btn-secondary" onClick={handleClearFilters}>Clear Filters</button>
              : <button className="btn btn-primary" onClick={() => navigate('/invoices/new')}><Plus size={16} /> Create Invoice</button>
          }
        />
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Drive</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td><strong>{inv.invoice_number}</strong></td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{inv.customer?.name || 'Unknown Customer'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{inv.vehicle_number || '-'}</td>
                    <td>
                      <span className={inv.transaction_type === 'CASH' ? 'badge badge-active' : 'badge badge-inactive'}>
                        {inv.transaction_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{formatAmount(inv.total_amount)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {inv.google_drive_status === 'UPLOADED' ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--color-success)', margin: '0 auto' }} title="Uploaded to Google Drive" />
                      ) : inv.google_drive_status === 'FAILED' ? (
                        <XCircle size={18} style={{ color: 'var(--color-danger)', margin: '0 auto' }} title="Upload Failed" />
                      ) : (
                        <Clock size={18} style={{ color: 'var(--color-text-faint)', margin: '0 auto' }} title="Not Uploaded" />
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={(e) => { e.stopPropagation(); handleDownloadPdf(inv.id, inv.invoice_number); }}
                      >
                        <Download size={14} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span className="pagination-info">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, count)} of {count}
            </span>
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
