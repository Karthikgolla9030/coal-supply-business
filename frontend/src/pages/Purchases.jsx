import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { getPurchases, getPurchaseSummary } from '../api/purchases';
import { getSuppliers } from '../api/suppliers';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/layout/FilterBar';
import { Search, ShoppingCart, Plus, Filter } from 'lucide-react';

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

export default function PurchasesPage() {
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  
  const [page, setPage] = useState(1);
  const [suppliers, setSuppliers] = useState([]);

  const debouncedSearch = useDebounce(search, 350);

  // Load suppliers for filter
  useEffect(() => {
    getSuppliers({ is_active: 'true' })
      .then(res => setSuppliers(res.data.results || res.data))
      .catch(console.error);
  }, []);

  const buildParams = useCallback(() => {
    const params = { page };
    if (debouncedSearch) params.search = debouncedSearch;
    if (supplierFilter) params.supplier = supplierFilter;
    
    // Simple date filtering (Today, This Week, This Month) could be added here
    // Currently omitted for simplicity, but could calculate dates and pass purchase_date__gte/lte
    
    return params;
  }, [debouncedSearch, supplierFilter, page, dateFilter]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = buildParams();

    getPurchases(params)
      .then((res) => {
        setPurchases(res.data.results || res.data);
        setCount(res.data.count ?? (res.data.results?.length ?? 0));
      })
      .catch(() => setError('Failed to load purchases.'))
      .finally(() => setLoading(false));
      
    // Fetch summary
    setSummaryLoading(true);
    const summaryParams = buildParams();
    delete summaryParams.page; // Summary applies to all pages
    
    getPurchaseSummary(summaryParams)
      .then(res => setSummary(res.data))
      .catch(console.error)
      .finally(() => setSummaryLoading(false));

  }, [buildParams]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, supplierFilter, dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(count / 25));

  return (
    <div className="page-content page-content-wide">
      {/* Header */}
      <PageHeader 
        title="Purchases"
        description="Track the coal you purchase from suppliers, quantities, and costs."
        action={
          <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
            <Plus size={16} /> Add Purchase
          </button>
        }
      />
      
      {/* Summary Cards */}
      <div className="card-grid">
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL PURCHASES</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : summary?.total_purchases || 0}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL COAL PURCHASED</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : `${Number(summary?.total_tons || 0).toLocaleString()} MT`}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL PURCHASE VALUE</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-primary)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.total_purchase_value)}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL GST</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.total_gst)}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <FilterBar>
        <div className="search-bar" style={{ flex: '1 1 300px' }}>
          <span className="search-bar-icon"><Search size={16} /></span>
          <input
            id="purchase-search"
            className="form-input"
            type="text"
            placeholder="Search by supplier, order no, truck..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="form-input" 
          value={supplierFilter} 
          onChange={e => setSupplierFilter(e.target.value)}
          style={{ width: 'auto', flex: '0 1 auto' }}
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        
        <select className="form-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width: 'auto', flex: '0 1 auto' }}>
          <option value="all">All Time</option>
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
          Loading purchases…
        </div>
      )}

      {/* Table */}
      {!loading && !error && purchases.length === 0 && (
        <EmptyState
          icon={<ShoppingCart size={48} />}
          title={search || supplierFilter ? "No purchases found" : "No purchases recorded yet."}
          message={
            search || supplierFilter
              ? "No results match your filters. Try adjusting them."
              : 'Add your coal purchases to start tracking your stock and expenses.'
          }
          action={
            !(search || supplierFilter) && (
              <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
                <Plus size={16} /> Add Purchase
              </button>
            )
          }
        />
      )}

      {!loading && !error && purchases.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Purchase / Order No.</th>
                  <th>Truck No.</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Rate / Ton</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/purchases/${p.id}`)} style={{ opacity: p.is_active ? 1 : 0.6 }}>
                    <td>
                      {new Date(p.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 500 }}>{p.supplier_name}</td>
                    <td>{p.purchase_order_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                    <td>{p.truck_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{Number(p.quantity_tons).toLocaleString()} MT</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{formatCurrency(p.rate_per_ton)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.total_amount)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {!p.is_active ? (
                        <span className="badge badge-voided">VOIDED</span>
                      ) : (
                        <span className="badge badge-success">RECORDED</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${p.id}`); }}>View</button>
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
