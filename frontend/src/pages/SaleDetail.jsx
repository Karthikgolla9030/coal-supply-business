import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusBadge from '../components/StatusBadge';
import {
  getSale,
  createSale,
  updateSale,
  archiveSale,
} from '../api/sales';
import { getCustomers, createCustomer } from '../api/customers';
import PageHeader from '../components/layout/PageHeader';
import { ArrowLeft, Save, Edit2, Plus, X } from 'lucide-react';
import { INDIAN_STATES } from '../utils/states';

const EMPTY_SALE = {
  sale_date: new Date().toISOString().split('T')[0],
  customer: '',
  sale_order_no: '',
  serial_no: '',
  truck_no: '',
  payment_type: '',
  quantity_tons: '',
  rate_per_ton: '',
  gst_rate: '',
  tcs_rate: '',
  notes: '',
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amount || 0);
};

function extractErrors(data) {
  if (!data || typeof data !== 'object') return {};
  const errors = {};
  for (const [key, val] of Object.entries(data)) {
    errors[key] = Array.isArray(val) ? val[0] : val;
  }
  return errors;
}

// ── Add Customer Modal ───────────────────────────────────────
function AddCustomerModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', phone: '', state: '', gstin: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setAlert(null);
    createCustomer(form)
      .then(res => {
        onCreated(res.data);
        onClose();
        setForm({ name: '', phone: '', state: '', gstin: '' });
      })
      .catch(err => {
        const errorData = err.response?.data;
        if (errorData?.detail) setAlert({ type: 'error', message: errorData.detail });
        else if (errorData) setErrors(extractErrors(errorData));
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Add New Customer</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        
        {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Customer Name" name="name" id="cust_name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required error={errors.name} />
          <FormField label="Phone Number" name="phone" id="cust_phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} error={errors.phone} />
          <FormField label="GSTIN (Optional)" name="gstin" id="cust_gstin" value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} error={errors.gstin} />
          
          <div className="form-field">
            <label htmlFor="cust_state">State</label>
            <select name="state" id="cust_state" className="form-input" value={form.state} onChange={e => setForm({...form, state: e.target.value})}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ── Sale Form / Detail ───────────────────────────────────────
export default function SaleDetailPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();

  const [editing, setEditing] = useState(isNew);
  const [sale, setSale] = useState(null);
  
  const [form, setForm] = useState(EMPTY_SALE);
  
  // Computed fields purely for display during edit
  const [computed, setComputed] = useState({ sale_amount: null, gst_amount: null, tcs_amount: null, total_amount: null });

  const [customers, setCustomers] = useState([]);
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  
  // Load initial data
  useEffect(() => {
    getCustomers({ is_active: 'true', limit: 100 })
      .then(res => setCustomers(res.data.results || res.data))
      .catch(console.error);

    if (!isNew) {
      setLoading(true);
      getSale(id)
        .then(res => {
          setSale(res.data);
          setForm({
            ...res.data,
            quantity_tons: res.data.quantity_tons || '',
            rate_per_ton: res.data.rate_per_ton || '',
            gst_rate: res.data.gst_rate || '',
            tcs_rate: res.data.tcs_rate || '',
            payment_type: res.data.payment_type || '',
          });
        })
        .catch(err => setAlert({ type: 'error', message: 'Failed to load sale details.' }))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  // Recalculate computed amounts locally
  useEffect(() => {
    if (form.quantity_tons === '' || form.rate_per_ton === '') {
      setComputed({ sale_amount: null, gst_amount: null, tcs_amount: null, total_amount: null });
      return;
    }

    const qty = parseFloat(form.quantity_tons) || 0;
    const rate = parseFloat(form.rate_per_ton) || 0;
    const gstRate = parseFloat(form.gst_rate) || 0;
    const tcsRate = parseFloat(form.tcs_rate) || 0;
    
    const sAmt = qty * rate;
    const gAmt = sAmt * (gstRate / 100);
    const tAmt_tcs = sAmt * (tcsRate / 100);
    const tAmt = sAmt + gAmt + tAmt_tcs;
    
    setComputed({
      sale_amount: sAmt,
      gst_amount: gAmt,
      tcs_amount: tAmt_tcs,
      total_amount: tAmt
    });
  }, [form.quantity_tons, form.rate_per_ton, form.gst_rate, form.tcs_rate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);

    const payload = { ...form };

    if (!payload.customer) {
      setErrors(prev => ({ ...prev, customer: 'Customer is required.' }));
      setAlert({ type: 'error', message: 'Please select a customer.' });
      return;
    }

    if (payload.quantity_tons === '' || payload.quantity_tons === null || Number(payload.quantity_tons) <= 0) {
      setErrors(prev => ({ ...prev, quantity_tons: 'Quantity must be greater than 0.' }));
      setAlert({ type: 'error', message: 'Please enter a valid coal quantity in tons.' });
      return;
    }

    if (payload.rate_per_ton === '' || payload.rate_per_ton === null || Number(payload.rate_per_ton) < 0) {
      setErrors(prev => ({ ...prev, rate_per_ton: 'Rate must be 0 or greater.' }));
      setAlert({ type: 'error', message: 'Please enter a valid rate per ton.' });
      return;
    }

    if (payload.gst_rate === '' || payload.gst_rate === null || payload.gst_rate === undefined) {
      payload.gst_rate = '0.00';
    }
    if (payload.tcs_rate === '' || payload.tcs_rate === null || payload.tcs_rate === undefined) {
      payload.tcs_rate = '0.00';
    }

    setSaving(true);
    
    const request = isNew ? createSale(payload) : updateSale(id, payload);
    
    request
      .then(res => {
        setSale(res.data);
        if (isNew) {
          navigate(`/sales/${res.data.id}`, { replace: true });
        } else {
          setEditing(false);
          setAlert({ type: 'success', message: 'Sale updated successfully.' });
        }
      })
      .catch(err => {
        const errorData = err.response?.data;
        if (errorData?.detail) {
          setAlert({ type: 'error', message: errorData.detail });
        } else if (errorData && typeof errorData === 'object') {
          const errs = extractErrors(errorData);
          setErrors(errs);
          const firstErrorMessage = Object.values(errs)[0];
          setAlert({ type: 'error', message: firstErrorMessage || 'Failed to save sale. Please check the form errors.' });
        } else {
          setAlert({ type: 'error', message: 'An unexpected error occurred.' });
        }
      })
      .finally(() => setSaving(false));
  };

  const handleArchive = () => {
    setSaving(true);
    archiveSale(id)
      .then(() => navigate('/sales'))
      .catch(err => {
        setAlert({ type: 'error', message: 'Failed to archive.' });
        setSaving(false);
      });
  };

  if (loading) return <div className="page-content loading-state"><span className="spinner" /> Loading…</div>;

  return (
    <div className="page-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sales')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Sales
      </button>

      <PageHeader
        title={isNew ? 'Add Sale' : `Sale ${sale.sale_order_no || `#${sale.id}`}`}
        description={!isNew ? `Recorded on ${new Date(sale.sale_date).toLocaleDateString()}` : null}
        action={
          !isNew && !editing && sale.is_active && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Edit2 size={16} /> Edit
            </button>
          )
        }
      />

      {alert && <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem' }}>{alert.message}</div>}
      
      {!isNew && !sale.is_active && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>This sale is archived and cannot be edited.</div>
      )}

      {editing ? (
        <form className="card" onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* SALE DETAILS */}
            <div>
              <h2 className="section-title">SALE DETAILS</h2>
              <div className="form-grid">
                <FormField type="date" label="Sale Date" name="sale_date" id="sale_date" value={form.sale_date} onChange={handleChange} required error={errors.sale_date} />
                
                <div className="form-field">
                  <label htmlFor="customer">Customer <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                      name="customer" 
                      id="customer" 
                      className="form-input" 
                      value={form.customer} 
                      onChange={handleChange} 
                      required 
                      style={{ flex: 1 }}
                    >
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(true)} title="Add New Customer">
                      <Plus size={16} />
                    </button>
                  </div>
                  {errors.customer && <div className="error-msg">{errors.customer}</div>}
                </div>

                <FormField label="Sale Order No." name="sale_order_no" id="sale_order_no" value={form.sale_order_no} onChange={handleChange} error={errors.sale_order_no} placeholder="e.g. SO-1025" />
                <FormField label="Serial No." name="serial_no" id="serial_no" value={form.serial_no} onChange={handleChange} error={errors.serial_no} placeholder="e.g. SN-001" />
                
                <div className="form-field">
                  <label htmlFor="payment_type">Payment Type (Optional)</label>
                  <select
                    name="payment_type"
                    id="payment_type"
                    className="form-input"
                    value={form.payment_type}
                    onChange={handleChange}
                  >
                    <option value="">Select Payment Type</option>
                    <option value="CREDIT">Credit (To be paid later)</option>
                    <option value="CASH">Cash (Expected immediately)</option>
                  </select>
                  {errors.payment_type && <div className="error-msg">{errors.payment_type}</div>}
                </div>
              </div>
            </div>

            {/* DELIVERY DETAILS */}
            <div>
              <h2 className="section-title">DELIVERY DETAILS</h2>
              <div className="form-grid">
                <FormField label="Truck No." name="truck_no" id="truck_no" value={form.truck_no} onChange={handleChange} error={errors.truck_no} placeholder="e.g. AP 40 XY 1234" />
                <FormField type="number" step="0.001" min="0.001" label="Coal Quantity (Tons)" name="quantity_tons" id="quantity_tons" value={form.quantity_tons} onChange={handleChange} required error={errors.quantity_tons} placeholder="Enter quantity in tons" />
              </div>
            </div>

            {/* PRICING */}
            <div>
              <h2 className="section-title">PRICING</h2>
              <div className="form-grid" style={{ alignItems: 'flex-start' }}>
                <FormField type="number" step="0.01" min="0" label="Rate per Ton" name="rate_per_ton" id="rate_per_ton" value={form.rate_per_ton} onChange={handleChange} required error={errors.rate_per_ton} placeholder="Enter rate per ton" />
                
                <div className="form-field">
                  <label>Sale Amount</label>
                  <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border)', color: computed.sale_amount === null ? 'var(--color-text-muted)' : 'inherit' }}>
                    {computed.sale_amount === null ? 'Enter quantity and rate' : formatCurrency(computed.sale_amount)}
                  </div>
                </div>

                <FormField type="number" step="0.01" min="0" label="GST Rate (%)" name="gst_rate" id="gst_rate" value={form.gst_rate} onChange={handleChange} error={errors.gst_rate} placeholder="Enter GST rate" />
                
                <div className="form-field">
                  <label>GST Amount</label>
                  <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border)', color: computed.gst_amount === null ? 'var(--color-text-muted)' : 'inherit' }}>
                    {computed.gst_amount === null ? 'Enter quantity and rate' : formatCurrency(computed.gst_amount)}
                  </div>
                </div>

                <FormField type="number" step="0.01" min="0" label="TCS Rate (%)" name="tcs_rate" id="tcs_rate" value={form.tcs_rate} onChange={handleChange} error={errors.tcs_rate} placeholder="Enter TCS rate" />
                
                <div className="form-field">
                  <label>TCS Amount</label>
                  <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border)', color: computed.tcs_amount === null ? 'var(--color-text-muted)' : 'inherit' }}>
                    {computed.tcs_amount === null ? 'Enter quantity and rate' : formatCurrency(computed.tcs_amount)}
                  </div>
                </div>

                <div className="form-field span-2">
                  <label>Total Amount</label>
                  <div className="form-input" style={{ backgroundColor: computed.total_amount === null ? 'var(--color-bg-subtle)' : 'var(--color-primary-light)', color: computed.total_amount === null ? 'var(--color-text-muted)' : 'var(--color-primary)', border: computed.total_amount === null ? '1px dashed var(--color-border)' : '1px solid var(--color-primary)', fontWeight: computed.total_amount === null ? 'normal' : 600, fontSize: computed.total_amount === null ? '1rem' : '1.1rem' }}>
                    {computed.total_amount === null ? 'Enter quantity and rate' : formatCurrency(computed.total_amount)}
                  </div>
                </div>
              </div>
            </div>

            {/* ADDITIONAL */}
            <div>
              <h2 className="section-title">ADDITIONAL INFORMATION</h2>
              <FormField label="Notes" name="notes" id="notes" as="textarea" value={form.notes} onChange={handleChange} error={errors.notes} />
            </div>

          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            {!isNew && <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setErrors({}); setAlert(null); }}>Cancel</button>}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <><Save size={16} /> Save Sale</>}
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* VIEW MODE */}
            <div>
              <h2 className="section-title">SALE DETAILS</h2>
              <div className="form-grid">
                <div className="detail-row"><span className="detail-label">Customer</span><span className="detail-value">{sale.customer_name}</span></div>
                <div className="detail-row"><span className="detail-label">Sale Date</span><span className="detail-value">{new Date(sale.sale_date).toLocaleDateString()}</span></div>
                <div className="detail-row"><span className="detail-label">Sale Order No.</span><span className="detail-value">{sale.sale_order_no || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Serial No.</span><span className="detail-value">{sale.serial_no || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Payment Type</span><span className="detail-value">{sale.payment_type || 'N/A'}</span></div>
              </div>
            </div>

            <div>
              <h2 className="section-title">DELIVERY DETAILS</h2>
              <div className="form-grid">
                <div className="detail-row"><span className="detail-label">Truck No.</span><span className="detail-value">{sale.truck_no || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Quantity</span><span className="detail-value">{Number(sale.quantity_tons).toLocaleString()} MT</span></div>
              </div>
            </div>

            <div>
              <h2 className="section-title">PRICING</h2>
              <div className="form-grid">
                <div className="detail-row"><span className="detail-label">Rate per Ton</span><span className="detail-value">{formatCurrency(sale.rate_per_ton)} / MT</span></div>
                <div className="detail-row"><span className="detail-label">Sale Value</span><span className="detail-value">{formatCurrency(sale.sale_amount)}</span></div>
                <div className="detail-row"><span className="detail-label">GST ({Number(sale.gst_rate)}%)</span><span className="detail-value">{formatCurrency(sale.gst_amount)}</span></div>
                <div className="detail-row"><span className="detail-label">TCS ({Number(sale.tcs_rate || 0)}%)</span><span className="detail-value">{formatCurrency(sale.tcs_amount || 0)}</span></div>
                <div className="detail-row"><span className="detail-label">Total Amount</span><span className="detail-value" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatCurrency(sale.total_amount)}</span></div>
              </div>
            </div>

            <div>
              <h2 className="section-title">PAYMENT STATUS</h2>
              <div className="form-grid">
                <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{sale.receivable_status ? sale.receivable_status.replace('_', ' ') : 'PENDING'}</span></div>
                <div className="detail-row"><span className="detail-label">Paid Amount</span><span className="detail-value" style={{ color: 'var(--color-success)', fontWeight: 600 }}>{formatCurrency(sale.receivable_paid || 0)}</span></div>
                <div className="detail-row"><span className="detail-label">Remaining Balance</span><span className="detail-value" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{formatCurrency(sale.receivable_remaining || sale.total_amount)}</span></div>
                {sale.receivable_id && (
                  <div className="detail-row">
                    <span className="detail-label"></span>
                    <span className="detail-value" style={{ paddingTop: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/ledger?tab=receivables')}>
                        View Receivable
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {sale.notes && (
              <div>
                <h2 className="section-title">Notes</h2>
                <p style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)' }}>{sale.notes}</p>
              </div>
            )}
            
            {sale.is_active && (
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                {confirmArchive ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--color-bg-subtle)', padding: '1rem', borderRadius: '0.5rem', border: '1px dashed var(--color-border)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                      {parseFloat(sale.receivable_paid || 0) > 0 ? (
                        <strong>This sale has financial history and cannot be permanently deleted. You can void the sale while keeping its records.</strong>
                      ) : (
                        <strong>Are you sure you want to void this sale? Its records will be preserved in the history.</strong>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setConfirmArchive(false)}>Cancel</button>
                      <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleArchive}>
                        {saving ? <span className="spinner" /> : 'Void Sale'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmArchive(true)}>
                    Delete Sale
                  </button>
                )}
              </div>
            )}
            
          </div>
        </div>
      )}
      
      <AddCustomerModal 
        isOpen={showCustomerModal} 
        onClose={() => setShowCustomerModal(false)} 
        onCreated={(newCustomer) => {
          setCustomers(prev => [...prev, newCustomer]);
          setForm(prev => ({ ...prev, customer: newCustomer.id }));
        }} 
      />
    </div>
  );
}
