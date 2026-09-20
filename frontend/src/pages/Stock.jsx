import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { getStockSummary, getStockMovements } from '../api/stock';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/layout/FilterBar';
import { Search, Package, AlertTriangle } from 'lucide-react';

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

export default function StockPage() {
  const navigate = useNavigate();

  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('all');
  
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);

  const buildParams = useCallback(() => {
    const params = { page };
    if (debouncedSearch) params.search = debouncedSearch;
    if (typeFilter !== 'ALL') params.type = typeFilter;
    
    // Future date filtering logic can be added here
    // Example: if (dateFilter === 'today') { params.start_date = ...; params.end_date = ...; }
    
    return params;
  }, [debouncedSearch, typeFilter, page, dateFilter]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = buildParams();

    getStockMovements(params)
      .then((res) => {
        setMovements(res.data.results || res.data);
        setCount(res.data.count ?? (res.data.results?.length ?? 0));
      })
      .catch(() => setError('Failed to load stock movements.'))
      .finally(() => setLoading(false));
      
    // Fetch summary
    setSummaryLoading(true);
    const summaryParams = buildParams();
    delete summaryParams.page; // Summary applies to all pages
    
    getStockSummary(summaryParams)
      .then(res => setSummary(res.data))
      .catch(console.error)
      .finally(() => setSummaryLoading(false));

  }, [buildParams]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(count / 50));
  
  const currentStock = Number(summary?.current_stock || 0);
  const isShortage = currentStock < 0;

  return (
    <div className="page-content page-content-wide">
      {/* Header */}
      <PageHeader 
        title="Stock"
        description="Track how much coal you purchased, sold, and currently have."
      />

      {isShortage && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Warning: Negative Stock</strong> - You have recorded more sales than purchases.
          </div>
        </div>
      )}

      {/* Primary Metrics (Quantities) */}
      <div className="card-grid">
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>TOTAL PURCHASED</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {summaryLoading ? '...' : `${Number(summary?.total_purchased || 0).toLocaleString()} MT`}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>TOTAL SOLD</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {summaryLoading ? '...' : `${Number(summary?.total_sold || 0).toLocaleString()} MT`}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>CURRENT STOCK</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: isShortage ? 'var(--color-danger)' : 'var(--color-primary)' }}>
            {summaryLoading ? '...' : `${currentStock.toLocaleString()} MT`}
          </div>
        </div>
      </div>
      
      <div className="card-grid">
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>PURCHASE VALUE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.purchase_value)}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>SALES VALUE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.sales_value)}
          </div>
        </div>
      </div>

      <h2 className="section-title">STOCK MOVEMENT</h2>

      <FilterBar>
        <div className="search-bar" style={{ flex: '1 1 300px' }}>
          <span className="search-bar-icon"><Search size={16} /></span>
          <input
            id="stock-search"
            className="form-input"
            type="text"
            placeholder="Search by party, order no, truck..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="form-input" 
          value={typeFilter} 
          onChange={e => setTypeFilter(e.target.value)}
          style={{ width: 'auto', flex: '0 1 auto' }}
        >
          <option value="ALL">All Movements</option>
          <option value="PURCHASE">Purchases Only</option>
          <option value="SALE">Sales Only</option>
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
          Loading stock movements…
        </div>
      )}

      {/* Table */}
      {!loading && !error && movements.length === 0 && (
        <EmptyState
          icon={<Package size={48} />}
          title={search || typeFilter !== 'ALL' ? "No movements found" : "NO STOCK MOVEMENTS YET"}
          message={
            search || typeFilter !== 'ALL'
              ? "No results match your filters. Try adjusting them."
              : 'Record your purchases and sales to start tracking your coal stock.'
          }
        />
      )}

      {!loading && !error && movements.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Supplier / Customer</th>
                  <th>Order No.</th>
                  <th>Truck No.</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Running Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, idx) => {
                  const isPurchase = m.type === 'PURCHASE';
                  const qty = Number(m.quantity);
                  const displayQty = qty > 0 ? `+${qty.toLocaleString()} MT` : `${qty.toLocaleString()} MT`;
                  const qtyColor = isPurchase ? 'var(--color-success)' : 'var(--color-danger)';
                  
                  return (
                    <tr key={`${m.type}-${m.id}`} onClick={() => navigate(`/${isPurchase ? 'purchases' : 'sales'}/${m.id}`)} style={{ opacity: m.is_active ? 1 : 0.6 }}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(m.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                          backgroundColor: isPurchase ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: qtyColor
                        }}>
                          {m.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{m.party_name || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{m.order_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{m.truck_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: qtyColor }}>{displayQty}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {Number(m.balance).toLocaleString()} MT
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/${isPurchase ? 'purchases' : 'sales'}/${m.id}`); }}>
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
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
