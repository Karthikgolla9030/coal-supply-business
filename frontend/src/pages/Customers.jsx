import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { getCustomers } from '../api/customers';
import { Search, Users, Plus } from 'lucide-react';

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CustomersPage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 350);

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = { page };
    if (debouncedSearch) params.search = debouncedSearch;
    if (showInactive) params.is_active = 'false';

    getCustomers(params)
      .then((res) => {
        setCustomers(res.data.results || res.data);
        setCount(res.data.count ?? (res.data.results?.length ?? 0));
      })
      .catch(() => setError('Failed to load customers. Please try again.'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, showInactive, page]);

  // Reset to page 1 when search or filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, showInactive]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const totalPages = Math.max(1, Math.ceil(count / 25));

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header flex justify-between items-center" style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            {count > 0 ? `${count} customer${count !== 1 ? 's' : ''}` : 'No customers yet'}
            {showInactive ? ' (including inactive)' : ''}
          </p>
        </div>
        <button
          className="btn btn-primary"
          id="add-customer-btn"
          onClick={() => navigate('/customers/new')}
        >
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-bar">
          <span className="search-bar-icon"><Search size={16} /></span>
          <input
            id="customer-search"
            className="form-input"
            type="text"
            placeholder="Search by name, GSTIN, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            id="show-inactive-toggle"
          />
          Show inactive
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
          Loading customers…
        </div>
      )}

      {/* Table */}
      {!loading && !error && customers.length === 0 && (
        <EmptyState
          icon={<Users size={48} />}
          title="No customers found"
          message={
            search
              ? `No results for "${search}". Try a different search term.`
              : 'Add your first customer to get started.'
          }
          action={
            !search && (
              <button className="btn btn-primary" onClick={() => navigate('/customers/new')}>
                <Plus size={16} /> Add Customer
              </button>
            )
          }
        />
      )}

      {!loading && !error && customers.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>GSTIN</th>
                  <th>Phone</th>
                  <th>State</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                      {c.gstin || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {c.phone || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {c.state || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}
                    </td>
                    <td><StatusBadge isActive={c.is_active} /></td>
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
