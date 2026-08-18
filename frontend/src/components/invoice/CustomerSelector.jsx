import { useState, useEffect, useRef, useCallback } from 'react';
import FormField from '../FormField';
import { getCustomers, createCustomer } from '../../api/customers';

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ── Add New Customer Modal ─────────────────────────────────── */
function AddCustomerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', address: '', gstin: '', state: '', state_code: '', phone: '', email: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);
    setSaving(true);
    try {
      const res = await createCustomer(form);
      onCreated(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data) {
        const errs = {};
        for (const [k, v] of Object.entries(data)) errs[k] = Array.isArray(v) ? v[0] : v;
        setErrors(errs);
        setAlert('Please fix the errors below.');
      } else {
        setAlert(data?.detail || 'Failed to save customer.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add New Customer</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {alert && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{alert}</div>}
            <div className="form-grid">
              <FormField label="Customer Name" name="name" id="new_cust_name" required
                value={form.name} onChange={handleChange} error={errors.name} placeholder="e.g. ABC Traders" />
              <FormField label="GSTIN" name="gstin" id="new_cust_gstin"
                value={form.gstin} onChange={handleChange} error={errors.gstin}
                placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15} />
              <FormField label="Phone" name="phone" id="new_cust_phone" type="tel"
                value={form.phone} onChange={handleChange} error={errors.phone}
                placeholder="e.g. 9876543210" />
              <FormField label="Email" name="email" id="new_cust_email" type="email"
                value={form.email} onChange={handleChange} error={errors.email} />
              <FormField label="State" name="state" id="new_cust_state"
                value={form.state} onChange={handleChange} error={errors.state} />
              <FormField label="State Code" name="state_code" id="new_cust_state_code"
                value={form.state_code} onChange={handleChange} error={errors.state_code} maxLength={10} />
              <div className="form-field span-2">
                <FormField label="Address" name="address" id="new_cust_address" as="textarea"
                  value={form.address} onChange={handleChange} error={errors.address} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="modal-save-customer-btn">
              {saving ? <><span className="spinner" /> Saving…</> : '+ Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Customer detail display ────────────────────────────────── */
function CustomerDisplay({ customer, onClear }) {
  const fields = [
    ['GSTIN',      customer.gstin],
    ['Address',    customer.address],
    ['State',      customer.state],
    ['State Code', customer.state_code],
    ['Phone',      customer.phone],
    ['Email',      customer.email],
  ];
  return (
    <div style={{
      background: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      marginTop: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
          {customer.name}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
          Change
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        {fields.map(([label, value]) => value ? (
          <div key={label}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{value}</div>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

/* ── Main CustomerSelector ──────────────────────────────────── */
/**
 * Props:
 *   selected   customer object | null
 *   onSelect   (customer) => void
 *   error      string | null
 */
export default function CustomerSelector({ selected, onSelect, error }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const debouncedQuery = useDebounce(query, 350);
  const wrapperRef = useRef(null);

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    getCustomers({ search: debouncedQuery, page: 1 })
      .then((res) => {
        setResults(res.data.results || res.data || []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (customer) => {
    onSelect(customer);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };

  const handleCreated = (newCustomer) => {
    setShowModal(false);
    handleSelect(newCustomer);
  };

  return (
    <div className="card">
      <div className="card-title">Customer / Receiver</div>

      {selected ? (
        <CustomerDisplay customer={selected} onClear={handleClear} />
      ) : (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <div className="search-bar" style={{ maxWidth: '100%' }}>
            <span className="search-bar-icon">🔍</span>
            <input
              id="customer-search-input"
              className={`form-input${error ? ' error' : ''}`}
              type="text"
              placeholder="Search customer by name, GSTIN, or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              autoComplete="off"
            />
          </div>

          {/* Dropdown */}
          {open && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 150,
              maxHeight: '260px',
              overflowY: 'auto',
            }}>
              {searching && (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  <span className="spinner" style={{ display: 'inline-block', marginRight: 'var(--space-2)' }} />
                  Searching…
                </div>
              )}
              {!searching && results.length === 0 && (
                <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
                  No customers found for "{query}"
                </div>
              )}
              {!searching && results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 'var(--space-3) var(--space-4)',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background var(--transition)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                    {c.name}
                  </span>
                  {c.gstin && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                      {c.gstin}
                    </span>
                  )}
                  {c.phone && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)' }}>
                      {c.phone}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {error && <p className="form-error" style={{ marginTop: 'var(--space-2)' }}>{error}</p>}

          {/* Add new customer link */}
          <div style={{ marginTop: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              id="add-new-customer-from-invoice"
              onClick={() => setShowModal(true)}
            >
              + Add New Customer
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
