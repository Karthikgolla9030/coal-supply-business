import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { getSales, getSaleSummary } from '../api/sales';
import { getCustomers } from '../api/customers';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/layout/FilterBar';
import { Search, Plus, ListTree } from 'lucide-react';

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amount || 0);
};

export default function SalesPage() {
  const navigate = useNavigate();

  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState([]);

  const debouncedSearch = useDebounce(search, 350);

  // Load customers for filter
  useEffect(() => {
    getCustomers({ is_active: 'true' })
      .then(res => setCustomers(res.data.results || res.data))
      .catch(console.error);
  }, []);

  const buildParams = useCallback(() => {
    const params = { page };
    if (debouncedSearch) params.search = debouncedSearch;
    if (customerFilter) params.customer = customerFilter;
    
    // Future date filtering logic can be added here
    
    return params;
  }, [debouncedSearch, customerFilter, page, dateFilter]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = buildParams();

    getSales(params)
      .then((res) => {
        setSales(res.data.results || res.data);
        setCount(res.data.count ?? (res.data.results?.length ?? 0));
      })
      .catch(() => setError('Failed to load sales.'))
      .finally(() => setLoading(false));
      
    // Fetch summary
    setSummaryLoading(true);
    const summaryParams = buildParams();
    delete summaryParams.page; // Summary applies to all pages
    
    getSaleSummary(summaryParams)
      .then(res => setSummary(res.data))
      .catch(console.error)
      .finally(() => setSummaryLoading(false));

  }, [buildParams]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, customerFilter, dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(count / 25));

  return (
    <div className="page-content page-content-wide">
      {/* Header */}
      <PageHeader 
        title="Sales"
        description="Track the coal you sell to customers, quantities, and sales value."
        action={
          <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>
            <Plus size={16} /> Add Sale
          </button>
        }
      />
      
      {/* Summary Cards */}
      <div className="card-grid">
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL SALES</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : summary?.total_sales || 0}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL COAL SOLD</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : `${Number(summary?.total_tons || 0).toLocaleString()} MT`}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL SALES VALUE</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-primary)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.total_sale_value)}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL GST</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.total_gst)}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL INCLUDING GST</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.total_including_gst)}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <FilterBar>
        <div className="search-bar" style={{ flex: '1 1 300px' }}>
          <span className="search-bar-icon"><Search size={16} /></span>
          <input
            id="sale-search"
            className="form-input"
            type="text"
            placeholder="Search by customer, order no, truck..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="form-input" 
          value={customerFilter} 
          onChange={e => setCustomerFilter(e.target.value)}
          style={{ width: 'auto', flex: '0 1 auto' }}
        >
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        
        <select className="form-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width: 'auto', flex: '0 1 auto' }}>
          <option value="all">All Time</option>
          {/* Future implementation */}
        </select>
      </FilterBar>

      {/* Error */}
      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
          Loading sales…
        </div>
      )}

      {/* Table */}
      {!loading && !error && sales.length === 0 && (
        <EmptyState
          icon={<ListTree size={48} />}
          title={search || customerFilter ? "No sales found" : "NO SALES RECORDED"}
          message={
            search || customerFilter
              ? "No results match your filters. Try adjusting them."
              : 'You haven\'t recorded any coal sales yet.'
          }
          action={
            !(search || customerFilter) && (
              <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>
                <Plus size={16} /> Add Sale
              </button>
            )
          }
        />
      )}

      {!loading && !error && sales.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Order / Sale No.</th>
                  <th>Truck No.</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Rate / Ton</th>
                  <th style={{ textAlign: 'right' }}>Sale Value</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/sales/${s.id}`)} style={{ opacity: s.is_active ? 1 : 0.6 }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(s.sale_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 500 }}>{s.customer_name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.sale_order_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.truck_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>{Number(s.quantity_tons).toLocaleString()} MT</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatCurrency(s.rate_per_ton)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(s.sale_amount)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(s.gst_amount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(s.total_amount)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {!s.is_active ? (
                        <span className="badge badge-voided">VOIDED</span>
                      ) : s.receivable_status ? (
                        <span className={`badge ${
                          s.receivable_status === 'PAID' ? 'badge-paid' :
                          s.receivable_status === 'PARTIALLY_PAID' ? 'badge-partial' :
                          'badge-pending'
                        }`}>
                          {s.receivable_status.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="badge badge-success">RECORDED</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/sales/${s.id}`); }}>View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
