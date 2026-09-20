import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { INDIAN_STATES } from '../utils/states';
import {
  getSupplier,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  reactivateSupplier,
} from '../api/suppliers';
import { ArrowLeft, Save, Edit2, ShoppingCart } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  address: '',
  gstin: '',
  aadhaar_no: '',
  state: '',
  pincode: '',
  phone: '',
  notes: '',
};

function extractErrors(data) {
  if (!data || typeof data !== 'object') return {};
  const errors = {};
  for (const [key, val] of Object.entries(data)) {
    errors[key] = Array.isArray(val) ? val[0] : val;
  }
  return errors;
}

import { getPurchases } from '../api/purchases';
import { getSupplierPurchaseSummary } from '../api/suppliers';

function SupplierPurchaseSummary({ supplierId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupplierPurchaseSummary(supplierId)
      .then(res => setSummary(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [supplierId]);

  if (loading || !summary) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <div className="card">
      <div className="card-title">Purchase Summary</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Total Purchases</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{summary.total_purchases}</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Total Tons</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{Number(summary.total_tons).toLocaleString()} MT</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Total Purchase Value</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-primary)' }}>{formatCurrency(summary.total_purchase_value)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Purchase History ──────────────────────────────────────────
function SupplierPurchaseHistory({ supplierId }) {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getPurchases({ supplier: supplierId })
      .then(res => setPurchases(res.data.results || res.data))
      .catch(err => setError('Failed to load purchases.'))
      .finally(() => setLoading(false));
  }, [supplierId]);

  if (loading) return <div className="card loading-state"><span className="spinner" /> Loading history...</div>;
  if (error) return <div className="card alert alert-error">{error}</div>;

  return (
    <div className="card">
      <div className="card-title">Purchase History</div>
      
      {purchases.length === 0 ? (
        <EmptyState 
          icon={<ShoppingCart size={48} />} 
          title="No purchases recorded yet." 
          message="Record a purchase from this supplier to track it here."
          action={<button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>Add Purchase</button>}
        />
      ) : (
        <div className="table-wrapper">
          <table style={{ fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                <th>Date</th>
                <th>Purchase No.</th>
                <th>Truck</th>
                <th style={{ textAlign: 'right' }}>Tons</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>GST</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} onClick={() => navigate(`/purchases/${p.id}`)} style={{ cursor: 'pointer', opacity: p.is_active ? 1 : 0.6 }}>
                  <td>{new Date(p.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{p.purchase_order_no || '—'}</td>
                  <td>{p.truck_no || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{Number(p.quantity_tons).toLocaleString()} MT</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(p.purchase_amount)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(p.gst_amount)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(p.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── New Supplier Form ─────────────────────────────────────────
function SupplierForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);
    setLoading(true);

    createSupplier(form)
      .then((res) => {
        navigate(`/suppliers/${res.data.id}`);
      })
      .catch((err) => {
        const errorData = err.response?.data;
        if (errorData?.detail) setAlert({ type: 'error', message: errorData.detail });
        else if (errorData) setErrors(extractErrors(errorData));
        else setAlert({ type: 'error', message: 'An unexpected error occurred. Please try again.' });
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="page-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/suppliers')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Suppliers
      </button>

      <div className="page-header">
        <h1 className="page-title">Add New Supplier</h1>
        <p className="page-subtitle">Enter supplier details to save them to your business.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Supplier Information</h2>
          <div className="form-grid">
            <FormField label="Supplier Name" name="name" id="name" value={form.name} onChange={handleChange} required error={errors.name} />
            <FormField label="Phone Number" name="phone" id="phone" value={form.phone} onChange={handleChange} error={errors.phone} />
            <FormField label="GSTIN (Optional)" name="gstin" id="gstin" value={form.gstin} onChange={handleChange} error={errors.gstin} placeholder="e.g. 29AAAAA0000A1Z5" />
            <FormField label="Aadhaar No. (Optional)" name="aadhaar_no" id="aadhaar_no" value={form.aadhaar_no} onChange={handleChange} error={errors.aadhaar_no} />
            
            <div className="form-field">
              <label htmlFor="state">State</label>
              <select name="state" id="state" className="form-input" value={form.state} onChange={handleChange}>
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.state && <div className="error-msg">{errors.state}</div>}
            </div>

            <FormField label="Pincode" name="pincode" id="pincode" value={form.pincode} onChange={handleChange} error={errors.pincode} />

            <div className="form-field span-2">
              <FormField label="Address" name="address" id="address" as="textarea" value={form.address} onChange={handleChange} error={errors.address} />
            </div>

            <div className="form-field span-2">
              <FormField label="Notes" name="notes" id="notes" as="textarea" value={form.notes} onChange={handleChange} error={errors.notes} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/suppliers')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading} id="save-supplier-btn">
            {loading ? <span className="spinner" /> : <><Save size={16} /> Save Supplier</>}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Supplier Detail & Edit Form ───────────────────────────────
function SupplierDetail({ id }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(location.state?.edit || false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');

  const loadSupplier = useCallback(() => {
    setLoading(true);
    getSupplier(id)
      .then((res) => {
        setSupplier(res.data);
        setForm({
          name: res.data.name || '',
          address: res.data.address || '',
          gstin: res.data.gstin || '',
          aadhaar_no: res.data.aadhaar_no || '',
          state: res.data.state || '',
          pincode: res.data.pincode || '',
          phone: res.data.phone || '',
          notes: res.data.notes || '',
        });
        setError(null);
      })
      .catch((err) => setError('Failed to load supplier details.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);
    setSaving(true);

    updateSupplier(id, form)
      .then((res) => {
        setSupplier(res.data);
        setEditing(false);
        setAlert({ type: 'success', message: 'Supplier updated successfully.' });
      })
      .catch((err) => {
        const errorData = err.response?.data;
        if (errorData?.detail) setAlert({ type: 'error', message: errorData.detail });
        else if (errorData) setErrors(extractErrors(errorData));
        else setAlert({ type: 'error', message: 'An unexpected error occurred.' });
      })
      .finally(() => setSaving(false));
  };

  const handleDeactivate = () => {
    setActionLoading(true);
    deactivateSupplier(id)
      .then(() => loadSupplier())
      .finally(() => { setActionLoading(false); setConfirmDeactivate(false); });
  };

  const handleReactivate = () => {
    setActionLoading(true);
    reactivateSupplier(id)
      .then(() => loadSupplier())
      .finally(() => setActionLoading(false));
  };

  if (loading) return <div className="page-content loading-state"><span className="spinner" /> Loading supplier…</div>;
  if (error) return <div className="page-content"><div className="alert alert-error">{error}</div></div>;
  if (!supplier) return null;

  return (
    <div className="page-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/suppliers')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Suppliers
      </button>

      <div className="page-header flex justify-between items-center" style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{supplier.name}</h1>
          <p className="page-subtitle">Supplier since {new Date(supplier.created_at).toLocaleDateString()}</p>
        </div>
        {!editing && (
          <button className="btn btn-secondary" id="edit-supplier-btn" onClick={() => setEditing(true)}>
            <Edit2 size={16} /> Edit
          </button>
        )}
      </div>

      {alert && <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem' }}>{alert.message}</div>}

      {editing ? (
        <form className="card" onSubmit={handleUpdate}>
          <div className="card-title">Edit Supplier</div>
          <div style={{ marginBottom: '2rem' }}>
            <div className="form-grid">
              <FormField label="Supplier Name" name="name" id="edit_name" value={form.name} onChange={handleChange} required error={errors.name} />
              <FormField label="Phone Number" name="phone" id="edit_phone" value={form.phone} onChange={handleChange} error={errors.phone} />
              <FormField label="GSTIN (Optional)" name="gstin" id="edit_gstin" value={form.gstin} onChange={handleChange} error={errors.gstin} />
              <FormField label="Aadhaar No. (Optional)" name="aadhaar_no" id="edit_aadhaar_no" value={form.aadhaar_no} onChange={handleChange} error={errors.aadhaar_no} />
              
              <div className="form-field">
                <label htmlFor="edit_state">State</label>
                <select name="state" id="edit_state" className="form-input" value={form.state} onChange={handleChange}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                {errors.state && <div className="error-msg">{errors.state}</div>}
              </div>

              <FormField label="Pincode" name="pincode" id="edit_pincode" value={form.pincode} onChange={handleChange} error={errors.pincode} />

              <div className="form-field span-2">
                <FormField label="Address" name="address" id="edit_address" as="textarea" value={form.address} onChange={handleChange} error={errors.address} />
              </div>
              <div className="form-field span-2">
                <FormField label="Notes" name="notes" id="edit_notes" as="textarea" value={form.notes} onChange={handleChange} error={errors.notes} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setErrors({}); setAlert(null); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="save-edit-supplier-btn">
              {saving ? <><span className="spinner" /> Saving…</> : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
            {['overview'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="card">
                <div className="card-title">Supplier Information</div>
                {[
                  ['Name', supplier.name],
                  ['Status', <StatusBadge active={supplier.is_active} />],
                  ['GSTIN', supplier.gstin || 'Not provided'],
                  ['Aadhaar Number', supplier.aadhaar_no ? `XXXX XXXX ${supplier.aadhaar_no.slice(-4)}` : 'Not provided'],
                  ['Phone', supplier.phone || '—'],
                  ['State', supplier.state || '—'],
                  ['Pincode', supplier.pincode || '—'],
                  ['Address', supplier.address || '—'],
                  ['Notes', supplier.notes || '—'],
                ].map(([label, value]) => (
                  <div className="detail-row" key={label}>
                    <span className="detail-label">{label}</span>
                    <span className={`detail-value${!value ? ' muted' : ''}`}>
                      {value || 'Not provided'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Deactivate / Reactivate */}
              <div className="card">
                <div className="card-title">Supplier Status</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <StatusBadge isActive={supplier.is_active} />
                    </div>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      {supplier.is_active
                        ? 'This supplier is active.'
                        : 'This supplier is inactive and will not appear in selection. Historical data is preserved.'}
                    </p>
                  </div>

                  {supplier.is_active ? (
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
                      <button className="btn btn-danger btn-sm" id="deactivate-supplier-btn" onClick={() => setConfirmDeactivate(true)}>
                        Deactivate Supplier
                      </button>
                    )
                  ) : (
                    <button className="btn btn-success btn-sm" disabled={actionLoading} id="reactivate-supplier-btn" onClick={handleReactivate}>
                      {actionLoading ? <span className="spinner" /> : 'Reactivate Supplier'}
                    </button>
                  )}
                </div>
              </div>

              <SupplierPurchaseSummary supplierId={id} />
              <SupplierPurchaseHistory supplierId={id} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Router entry-point ─────────────────────────────────────────
export default function SupplierDetailPage() {
  const { id } = useParams();
  if (id === 'new') return <SupplierForm />;
  return <SupplierDetail id={id} />;
}
