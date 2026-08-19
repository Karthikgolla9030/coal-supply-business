import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { INDIAN_STATES, getStateCode } from '../utils/states';
import {
  getCustomer,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
} from '../api/customers';
import { getInvoices, downloadInvoicePdf } from '../api/invoices';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Save, Edit2, CheckCircle, AlertCircle } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  address: '',
  gst_registered: false,
  gstin: '',
  state: '',
  state_code: '',
  phone: '',
  email: '',
};

function extractErrors(data) {
  if (!data || typeof data !== 'object') return {};
  const errors = {};
  for (const [key, val] of Object.entries(data)) {
    errors[key] = Array.isArray(val) ? val[0] : val;
  }
  return errors;
}

// ── Customer Invoice History ──────────────────────────────────
function CustomerInvoiceHistory({ customerId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    getInvoices({ customer: customerId, page })
      .then(res => {
        setInvoices(res.data.results);
        setCount(res.data.count);
        setError('');
      })
      .catch(err => setError('Failed to load invoices.'))
      .finally(() => setLoading(false));
  }, [customerId, page]);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
    }).format(amount);
  };

  if (loading && invoices.length === 0) return <div className="loading-state"><span className="spinner" /> Loading history...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (invoices.length === 0) return <EmptyState icon={<FileText size={48} />} title="No invoices found" message="This customer has no invoice history." />;

  return (
    <div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '0.75rem' }}>Invoice</th>
              <th style={{ padding: '0.75rem' }}>Date</th>
              <th style={{ padding: '0.75rem' }}>Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '0.75rem' }}>
                  <Link to={`/invoices/${inv.id}`} style={{ fontWeight: '500', color: 'var(--color-primary)' }}>
                    {inv.invoice_number}
                  </Link>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td style={{ padding: '0.75rem' }}>{inv.transaction_type}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatAmount(inv.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {count > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={page * pageSize >= count} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Customer form ─────────────────────────────────────────
function CustomerForm({ onSaved }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
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
      setForm((p) => ({ ...p, gst_registered: val, gstin: val ? p.gstin : '' }));
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
      const res = await createCustomer(form);
      navigate(`/customers/${res.data.id}`);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data) {
        setErrors(extractErrors(data));
        setAlert({ type: 'error', message: 'Please fix the errors below.' });
      } else {
        setAlert({ type: 'error', message: data?.detail || 'Failed to save. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => navigate('/customers')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 className="page-title">Add Customer</h1>
          <p className="page-subtitle">Create a new customer record</p>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card">
          <div className="card-title">Customer Information</div>
          <div className="form-grid">
            <FormField label="Customer Name" name="name" id="customer_name" required
              value={form.name} onChange={handleChange} error={errors.name}
              placeholder="e.g. ABC Traders" />
              
            <div className="form-field span-2">
              <label>GST Registration *</label>
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
              <div className="help-text" style={{ marginTop: '0.25rem' }}>
                {form.gst_registered ? "Select GST Registered only if the customer has a valid GST registration." : "No GSTIN is required for an unregistered customer."}
              </div>
            </div>

            {form.gst_registered ? (
              <FormField label="GSTIN *" name="gstin" id="customer_gstin" required
                value={form.gstin} onChange={handleChange} error={errors.gstin}
                placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15} />
            ) : (
              <div className="form-field">
                <label>GSTIN</label>
                <input type="text" value="Not Applicable" disabled className="input disabled" />
              </div>
            )}
            <FormField label="Phone" name="phone" id="customer_phone" type="tel"
              value={form.phone} onChange={handleChange} error={errors.phone}
              placeholder="e.g. 9876543210" />
            <FormField label="Email" name="email" id="customer_email" type="email"
              value={form.email} onChange={handleChange} error={errors.email}
              placeholder="e.g. buyer@example.com" />
            <div className="form-field">
              <label htmlFor="customer_state">State</label>
              <select
                id="customer_state"
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
            <FormField label="State Code" name="state_code" id="customer_state_code"
              value={form.state_code} readOnly help="Derived automatically" />
            <div className="form-field span-2">
              <FormField label="Address" name="address" id="customer_address" as="textarea"
                value={form.address} onChange={handleChange} error={errors.address}
                placeholder="Full billing address" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/customers')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} id="save-customer-btn">
            {saving ? (
              <><span className="spinner" /> Saving…</>
            ) : (
              <><Save size={16} /> Save Customer</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Customer Detail / Edit ─────────────────────────────────────
function CustomerDetail({ id }) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const loadCustomer = () => {
    setLoading(true);
    getCustomer(id)
      .then((res) => {
        setCustomer(res.data);
        setForm({
          name:       res.data.name       ?? '',
          address:    res.data.address    ?? '',
          gst_registered: res.data.gst_registered ?? false,
          gstin:      res.data.gstin      ?? '',
          state:      res.data.state      ?? '',
          state_code: res.data.state_code ?? '',
          phone:      res.data.phone      ?? '',
          email:      res.data.email      ?? '',
        });
      })
      .catch(() => setAlert({ type: 'error', message: 'Customer not found.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCustomer(); }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'state') {
      const code = getStateCode(value);
      setForm((p) => ({ ...p, state: value, state_code: code }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);
    setSaving(true);
    try {
      const res = await updateCustomer(id, form);
      setCustomer(res.data);
      setEditing(false);
      setAlert({ type: 'success', message: 'Customer updated successfully.' });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data) {
        setErrors(extractErrors(data));
        setAlert({ type: 'error', message: 'Please fix the errors below.' });
      } else {
        setAlert({ type: 'error', message: data?.detail || 'Failed to update customer.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setActionLoading(true);
    setAlert(null);
    try {
      await deactivateCustomer(id);
      setCustomer((p) => ({ ...p, is_active: false }));
      setAlert({ type: 'success', message: 'Customer deactivated.' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to deactivate.' });
    } finally {
      setActionLoading(false);
      setConfirmDeactivate(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    setAlert(null);
    try {
      await reactivateCustomer(id);
      setCustomer((p) => ({ ...p, is_active: true }));
      setAlert({ type: 'success', message: 'Customer reactivated.' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to reactivate.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="page-content">
      <div className="loading-state"><div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />Loading…</div>
    </div>
  );

  if (!customer && !loading) return (
    <div className="page-content">
      <div className="alert alert-error">Customer not found.</div>
      <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to Customers</button>
    </div>
  );

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => navigate('/customers')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h1 className="page-title">{customer.name}</h1>
            <StatusBadge isActive={customer.is_active} />
          </div>
          <p className="page-subtitle">
            Customer since {new Date(customer.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {!editing && (
          <button className="btn btn-secondary" id="edit-customer-btn" onClick={() => { setEditing(true); setAlert(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Edit2 size={16} /> Edit
          </button>
        )}
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* View / Edit */}
      {editing ? (
        <form onSubmit={handleSave} noValidate>
          <div className="card">
            <div className="card-title">Edit Customer</div>
            <div className="form-grid">
              <FormField label="Customer Name" name="name" id="edit_name" required value={form.name} onChange={handleChange} error={errors.name} />
              
              <div className="form-field span-2">
                <label>GST Registration *</label>
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
                <FormField label="GSTIN *" name="gstin" id="edit_gstin" required value={form.gstin} onChange={handleChange} error={errors.gstin} maxLength={15} />
              ) : (
                <div className="form-field">
                  <label>GSTIN</label>
                  <input type="text" value="Not Applicable" disabled className="input disabled" />
                </div>
              )}
              <FormField label="Phone" name="phone" id="edit_phone" type="tel" value={form.phone} onChange={handleChange} error={errors.phone} />
              <FormField label="Email" name="email" id="edit_email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
              <div className="form-field">
                <label htmlFor="edit_state">State</label>
                <select
                  id="edit_state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={errors.state ? 'error' : ''}
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
              <FormField label="State Code" name="state_code" id="edit_state_code" value={form.state_code} readOnly help="Derived automatically" />
              <div className="form-field span-2">
                <FormField label="Address" name="address" id="edit_address" as="textarea" value={form.address} onChange={handleChange} error={errors.address} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setErrors({}); setAlert(null); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="save-edit-customer-btn">
              {saving ? <><span className="spinner" /> Saving…</> : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="card">
            <div className="card-title">Customer Information</div>
            {[
              ['Name', customer.name],
              ['Status', <StatusBadge active={customer.is_active} />],
              ['GST Status', customer.gst_registered ? 'GST Registered' : 'Unregistered'],
              ['GSTIN', customer.gst_registered ? customer.gstin : 'Not Applicable'],
              ['Phone', customer.phone || '—'],
              ['Email', customer.email || '—'],
              ['State', customer.state || '—'],
              ['State Code', customer.state_code || '—'],
              ['Address', customer.address || '—'],
            ].map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span className="detail-label">{label}</span>
                <span className={`detail-value${!value ? ' muted' : ''}`}>
                  {value || 'Not provided'}
                </span>
              </div>
            ))}
          </div>

          {/* Invoice History */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Invoice History</span>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => navigate(`/invoices?customer=${id}`)}
              >
                View in Invoices
              </button>
            </div>
            <CustomerInvoiceHistory customerId={id} />
          </div>

          {/* Deactivate / Reactivate */}
          <div className="card">
            <div className="card-title">Customer Status</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <StatusBadge isActive={customer.is_active} />
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  {customer.is_active
                    ? 'This customer is active and can be selected for new invoices.'
                    : 'This customer is inactive and will not appear in invoice selection. Historical invoices are preserved.'}
                </p>
              </div>

              {customer.is_active ? (
                confirmDeactivate ? (
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Are you sure?</span>
                    <button className="btn btn-danger btn-sm" disabled={actionLoading} onClick={handleDeactivate} id="confirm-deactivate-btn">
                      {actionLoading ? <span className="spinner" /> : 'Yes, Deactivate'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeactivate(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-danger btn-sm" id="deactivate-customer-btn" onClick={() => setConfirmDeactivate(true)}>
                    Deactivate Customer
                  </button>
                )
              ) : (
                <button className="btn btn-success btn-sm" disabled={actionLoading} id="reactivate-customer-btn" onClick={handleReactivate}>
                  {actionLoading ? <span className="spinner" /> : 'Reactivate Customer'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Router entry-point ─────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams();
  if (id === 'new') return <CustomerForm />;
  return <CustomerDetail id={id} />;
}
