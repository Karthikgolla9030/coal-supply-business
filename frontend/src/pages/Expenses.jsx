import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { getExpenses, getExpenseSummary } from '../api/expenses';
import PageHeader from '../components/layout/PageHeader';
import FilterBar from '../components/layout/FilterBar';
import { Search, Receipt, Plus } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

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

export const EXPENSE_CATEGORIES = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'LOADING', label: 'Loading' },
  { value: 'UNLOADING', label: 'Unloading' },
  { value: 'LABOUR', label: 'Labour' },
  { value: 'COMMISSION', label: 'Commission' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'REPAIRS', label: 'Repairs' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'FUEL', label: 'Fuel' },
  { value: 'OTHER', label: 'Other' },
];

export default function Expenses() {
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);

  const buildParams = useCallback(() => {
    const params = { page };
    if (debouncedSearch) params.search = debouncedSearch;
    if (categoryFilter !== 'ALL') params.category = categoryFilter;
    return params;
  }, [debouncedSearch, categoryFilter, page]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = buildParams();

    getExpenses(params)
      .then((res) => {
        setExpenses(res.data.results || res.data);
        setCount(res.data.count ?? (res.data.results?.length ?? 0));
      })
      .catch(() => setError('Failed to load expenses.'))
      .finally(() => setLoading(false));
      
    // Fetch summary
    setSummaryLoading(true);
    const summaryParams = buildParams();
    delete summaryParams.page; // Summary applies to all pages
    
    getExpenseSummary(summaryParams)
      .then(res => setSummary(res.data))
      .catch(console.error)
      .finally(() => setSummaryLoading(false));

  }, [buildParams]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(count / 50));
  
  const categoryBreakdown = summary?.category_breakdown || {};
  const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : 'None';

  return (
    <div className="page-content page-content-wide">
      <PageHeader 
        title="Expenses"
        description="Track your business expenses and operating costs."
        action={
          <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>
            <Plus size={16} /> Add Expense
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="card-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>TOTAL EXPENSES</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-danger)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.total_expenses)}
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>THIS MONTH</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {summaryLoading ? '...' : formatCurrency(summary?.this_month)}
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>TOP CATEGORY</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summaryLoading ? '...' : topCategory}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card">
          <div className="card-title">Category Breakdown</div>
          {summaryLoading ? (
             <div className="loading-state"><span className="spinner" /></div>
          ) : sortedCategories.length === 0 ? (
             <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No expenses recorded.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {sortedCategories.map(([cat, amount]) => (
                <div key={cat} style={{ border: '1px solid var(--color-border)', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{cat}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{formatCurrency(amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="section-title">ALL EXPENSES</h2>

      {/* Toolbar */}
      <FilterBar>
        <div className="search-bar" style={{ flex: '1 1 300px' }}>
          <span className="search-bar-icon"><Search size={16} /></span>
          <input
            id="expense-search"
            className="form-input"
            type="text"
            placeholder="Search by description, paid to, ref no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="form-input" 
          value={categoryFilter} 
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ width: 'auto', flex: '0 1 auto' }}
        >
          <option value="ALL">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
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
          Loading expenses…
        </div>
      )}

      {/* Table */}
      {!loading && !error && expenses.length === 0 && (
        <EmptyState
          icon={<Receipt size={48} />}
          title={search || categoryFilter !== 'ALL' ? "No expenses found" : "NO EXPENSES RECORDED"}
          message={
            search || categoryFilter !== 'ALL'
              ? "No results match your filters. Try adjusting them."
              : 'Start recording your business expenses to understand your operating costs.'
          }
          action={<button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>Add Expense</button>}
        />
      )}

      {!loading && !error && expenses.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Paid To</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Ref No.</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} onClick={() => navigate(`/expenses/${exp.id}`)} style={{ opacity: exp.is_active ? 1 : 0.6 }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(exp.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                        backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text)'
                      }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{exp.description}</td>
                    <td>{exp.paid_to || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-danger)' }}>
                      {formatCurrency(exp.amount)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{exp.reference_no || <span style={{ color: 'var(--color-text-faint)' }}>—</span>}</td>
                    <td>
                      {!exp.is_active ? (
                        <span className="badge badge-voided">VOIDED</span>
                      ) : (
                        <span className="badge badge-success">RECORDED</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/expenses/${exp.id}`); }}>
                        View
                      </button>
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
