import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { getSuppliers } from '../api/suppliers';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/layout/FilterBar';
import { Search, Plus, MapPin, Phone, Truck } from 'lucide-react';

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SuppliersPage() {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 350);

  const fetchSuppliers = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = { page };
    if (debouncedSearch) params.search = debouncedSearch;
    if (showInactive) params.is_active = 'false';

    getSuppliers(params)
      .then((res) => {
        setSuppliers(res.data.results || res.data);
        setCount(res.data.count ?? (res.data.results?.length ?? 0));
      })
      .catch(() => setError('Failed to load suppliers. Please try again.'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, showInactive, page]);

  // Reset to page 1 when search or filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, showInactive]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const totalPages = Math.max(1, Math.ceil(count / 25));

  return (
    <div className="page-content">
      {/* Header */}
      <PageHeader 
        title="Suppliers"
        description="Manage the suppliers you purchase coal from."
        action={
          <button
            className="btn btn-primary"
            id="add-supplier-btn"
            onClick={() => navigate('/suppliers/new')}
          >
            <Plus size={16} /> Add Supplier
          </button>
        }
      />

      {/* Toolbar */}
      <FilterBar>
        <div className="search-bar" style={{ flex: '1 1 300px' }}>
          <span className="search-bar-icon"><Search size={16} /></span>
          <input
            id="supplier-search"
            className="form-input"
            type="text"
            placeholder="Search by name, GST, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Show inactive</span>
        </label>
      </FilterBar>

      {/* Error */}
      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
          Loading suppliers…
        </div>
      )}

      {/* Table */}
      {!loading && !error && suppliers.length === 0 && (
        <EmptyState
          icon={<Truck size={48} />}
          title={search ? "No suppliers found" : "No suppliers added yet."}
          message={
            search
              ? `No results for "${search}". Try a different search term.`
              : 'Add your coal suppliers to start recording purchases.'
          }
          action={
            !search && (
              <button className="btn btn-primary" onClick={() => navigate('/suppliers/new')}>
                <Plus size={16} /> Add Supplier
              </button>
            )
          }
        />
      )}

      {!loading && !error && suppliers.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Phone</th>
                  <th>GSTIN / Aadhaar</th>
                  <th>State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/suppliers/${s.id}`)}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                      <div>{s.phone || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                      <div style={{ fontFamily: 'monospace' }}>{s.gstin || s.aadhaar_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                      <div>{s.state || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${s.id}`); }}>View</button>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${s.id}`, { state: { edit: true } }); }}>Edit</button>
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
