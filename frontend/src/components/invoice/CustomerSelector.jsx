import { useState, useEffect, useRef, useCallback } from 'react';
import FormField from '../FormField';
import { getCustomers, createCustomer, updateCustomer } from '../../api/customers';
import { INDIAN_STATES, getStateCode } from '../../utils/states';
import { Plus, X, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ── Add New Party Modal ─────────────────────────────────── */
function AddPartyModal({ onClose, onCreated, initialPartyType = 'CUSTOMER', initialData = null }) {
  const isEditMode = !!initialData;
  const [form, setForm] = useState(initialData ? { ...initialData } : {
    name: '', party_type: initialPartyType, address: '', gst_registered: false, gstin: '', aadhaar_no: '', state: '', state_code: '', phone: '', email: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === 'checkbox' ? checked : value;
    if (name === 'gst_registered') val = value === 'true';

    if (name === 'state') {
      const code = getStateCode(val);
      setForm((p) => ({ ...p, state: val, state_code: code }));
    } else if (name === 'gst_registered') {
      setForm((p) => ({ ...p, gst_registered: val, gstin: val ? p.gstin : '', aadhaar_no: val ? '' : p.aadhaar_no }));
    } else {
      setForm((p) => ({ ...p, [name]: val }));
    }
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);
    setSaving(true);
    try {
      if (isEditMode) {
        const res = await updateCustomer(initialData.id, form);
        onCreated(res.data);
      } else {
        const res = await createCustomer(form);
        onCreated(res.data);
      }
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

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isEditMode ? 'Edit Customer' : 'Add Customer'}</span>
          <button className="modal-close" type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {alert && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{alert}</div>}
            <div className="form-grid">
              <FormField label="Customer Name" name="name" id="new_cust_name" required
                value={form.name} onChange={handleChange} error={errors.name} placeholder="e.g. ABC Traders" />


              <div className="form-field span-2">
                <label>GST Registration <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                    <input type="radio" name="gst_registered" value="true" checked={form.gst_registered === true} onChange={handleChange} />
                    GST Registered
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                    <input type="radio" name="gst_registered" value="false" checked={form.gst_registered === false} onChange={handleChange} />
                    Unregistered
                  </label>
                </div>
              </div>

              {form.gst_registered ? (
                <FormField label="GSTIN" name="gstin" id="new_cust_gstin" required
                  value={form.gstin} onChange={handleChange} error={errors.gstin}
                  placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15} />
              ) : (
                <FormField label="Aadhaar No. (Optional)" name="aadhaar_no" id="new_cust_aadhaar"
                  value={form.aadhaar_no} onChange={handleChange} error={errors.aadhaar_no}
                  placeholder="e.g. 123456789012" maxLength={12} />
              )}
              <FormField label="Phone" name="phone" id="new_cust_phone" type="tel"
                value={form.phone} onChange={handleChange} error={errors.phone}
                placeholder="e.g. 9876543210" />
              <FormField label="Email" name="email" id="new_cust_email" type="email"
                value={form.email} onChange={handleChange} error={errors.email} />
              <div className="form-field">
                <label htmlFor="new_cust_state">State</label>
                <select
                  id="new_cust_state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={`form-input ${errors.state ? 'error' : ''}`}
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.state && <div className="error-msg">{errors.state}</div>}
              </div>
              <FormField label="State Code" name="state_code" id="new_cust_state_code"
                value={form.state_code} readOnly help="Derived automatically" />
              <div className="form-field span-2">
                <FormField label="Address" name="address" id="new_cust_address" as="textarea"
                  value={form.address} onChange={handleChange} error={errors.address} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="modal-save-customer-btn">
              {saving ? <><span className="spinner" /> Saving…</> : (isEditMode ? 'Update Customer' : 'Save Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ── Customer detail display ────────────────────────────────── */
function CustomerDisplay({ customer, onClear, onEdit }) {
  const fields = [
    ['GST Status', customer.gst_registered ? 'GST Registered' : 'Unregistered'],
    customer.gst_registered 
      ? ['GSTIN', customer.gstin || '—'] 
      : ['Aadhaar No', customer.aadhaar_no || 'Not Provided'],
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onEdit && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
              Edit
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
            Change
          </button>
        </div>
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
 *   partyType  string | array | null
 *   label      string (optional, overrides default)
 *   helperText string (optional)
 */
export default function CustomerSelector({ selected, onSelect, error, partyType, label, helperText }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 350);
  const wrapperRef = useRef(null);

  const fetchResults = useCallback(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    let params = { search: debouncedQuery, is_active: 'true' };
    if (partyType) {
      if (Array.isArray(partyType)) {
        params.party_type_in = partyType.join(',');
      } else {
        params.party_type = partyType;
      }
    }
    getCustomers(params)
      .then((res) => {
        setResults(res.data.results || res.data || []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery, partyType]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

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

  return (
    <div style={{ position: 'relative' }}>
      <label className="form-label" style={{ display: 'block', marginBottom: helperText ? '0.25rem' : '0.5rem' }}>
        {label || 'Customer / Receiver'}
      </label>
      {helperText && (
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          {helperText}
        </div>
      )}

      {selected ? (
        <CustomerDisplay customer={selected} onClear={handleClear} onEdit={() => setEditModalOpen(true)} />
      ) : (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <div className="search-bar" style={{ position: 'relative' }}>
            <span className="search-bar-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><Search size={16} /></span>
            <input
              id="customer-search-input"
              type="text"
              className={`form-control${error ? ' error' : ''}`}
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search customer by name, GSTIN, or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              autoComplete="off"
            />
          </div>

          {open && (
            <ul style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
              zIndex: 150, maxHeight: '260px', overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0,
            }}>
              {searching && <li style={{ padding: 'var(--space-4)', textAlign: 'center' }}>Searching…</li>}
              {!searching && results.length === 0 && <li style={{ padding: 'var(--space-4)', textAlign: 'center' }}>No results</li>}
              {results.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{r.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'flex', gap: '1rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {r.party_type ? r.party_type.charAt(0) + r.party_type.slice(1).toLowerCase() : 'Customer'}
                    </span>
                    <span>{r.gst_registered ? `GSTIN: ${r.gstin}` : `Aadhaar: ${r.aadhaar_no || 'N/A'}`}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="form-error" style={{ marginTop: 'var(--space-2)' }}>{error}</p>}

          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAddModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Plus size={16} /> {label === 'PARTY' ? 'Add New Party' : 'Add New Customer'}
            </button>
          </div>
        </div>
      )}

      {addModalOpen && (
        <AddPartyModal
          initialPartyType={Array.isArray(partyType) ? partyType[0] : (partyType || 'CUSTOMER')}
          onClose={() => setAddModalOpen(false)}
          onCreated={(newCust) => {
            setAddModalOpen(false);
            handleSelect(newCust);
          }}
        />
      )}

      {editModalOpen && selected && (
        <AddPartyModal
          initialData={selected}
          onClose={() => setEditModalOpen(false)}
          onCreated={(updatedCust) => {
            setEditModalOpen(false);
            onSelect(updatedCust); // Update the parent's selected state
          }}
        />
      )}
    </div>
  );
}
