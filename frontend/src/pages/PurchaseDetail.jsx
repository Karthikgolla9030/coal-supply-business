import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/layout/PageHeader';
import {
  getPurchase,
  createPurchase,
  updatePurchase,
  archivePurchase,
} from '../api/purchases';
import { getSuppliers, createSupplier } from '../api/suppliers';
import { ArrowLeft, Save, Edit2, AlertCircle, Plus, X } from 'lucide-react';
import { INDIAN_STATES } from '../utils/states';

const EMPTY_PURCHASE = {
  purchase_date: new Date().toISOString().split('T')[0],
  supplier: '',
  purchase_order_no: '',
  serial_no: '',
  truck_no: '',
  quantity_tons: '',
  rate_per_ton: '',
  gst_rate: '',
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

// ── Add Supplier Modal ───────────────────────────────────────
function AddSupplierModal({ isOpen, onClose, onCreated }) {
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
    createSupplier(form)
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
          <h2 className="section-title" style={{ margin: 0 }}>Add New Supplier</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        
        {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Supplier Name" name="name" id="sup_name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required error={errors.name} />
          <FormField label="Phone Number" name="phone" id="sup_phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} error={errors.phone} />
          <FormField label="GSTIN (Optional)" name="gstin" id="sup_gstin" value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} error={errors.gstin} />
          
          <div className="form-field">
            <label htmlFor="sup_state">State</label>
            <select name="state" id="sup_state" className="form-input" value={form.state} onChange={e => setForm({...form, state: e.target.value})}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ── Purchase Form / Detail ───────────────────────────────────
export default function PurchaseDetailPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();

  const [editing, setEditing] = useState(isNew);
  const [purchase, setPurchase] = useState(null);
  
  const [form, setForm] = useState(EMPTY_PURCHASE);
  
  // Computed fields purely for display during edit
  const [computed, setComputed] = useState({ purchase_amount: null, gst_amount: null, total_amount: null });

  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  
  // Load initial data
  useEffect(() => {
    getSuppliers({ is_active: 'true', limit: 100 })
      .then(res => setSuppliers(res.data.results || res.data))
      .catch(console.error);

    if (!isNew) {
      setLoading(true);
      getPurchase(id)
        .then(res => {
          setPurchase(res.data);
          setForm({
            ...res.data,
            quantity_tons: res.data.quantity_tons || '',
            rate_per_ton: res.data.rate_per_ton || '',
            gst_rate: res.data.gst_rate || '',
          });
        })
        .catch(err => setAlert({ type: 'error', message: 'Failed to load purchase details.' }))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  // Recalculate computed amounts locally
  useEffect(() => {
    if (form.quantity_tons === '' || form.rate_per_ton === '') {
      setComputed({ purchase_amount: null, gst_amount: null, total_amount: null });
      return;
    }
    
    const qty = parseFloat(form.quantity_tons) || 0;
    const rate = parseFloat(form.rate_per_ton) || 0;
    const gstRate = parseFloat(form.gst_rate) || 0;
    
    const pAmt = qty * rate;
    const gAmt = pAmt * (gstRate / 100);
    const tAmt = pAmt + gAmt;
    
    setComputed({
      purchase_amount: pAmt,
      gst_amount: gAmt,
      total_amount: tAmt
    });
  }, [form.quantity_tons, form.rate_per_ton, form.gst_rate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);

    const payload = { ...form };

    if (!payload.supplier) {
      setErrors(prev => ({ ...prev, supplier: 'Supplier is required.' }));
      setAlert({ type: 'error', message: 'Please select a supplier.' });
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

    setSaving(true);
    
    const request = isNew ? createPurchase(payload) : updatePurchase(id, payload);
    
    request
      .then(res => {
        setPurchase(res.data);
        if (isNew) {
          navigate(`/purchases/${res.data.id}`, { replace: true });
        } else {
          setEditing(false);
          setAlert({ type: 'success', message: 'Purchase updated successfully.' });
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
          setAlert({ type: 'error', message: firstErrorMessage || 'Failed to save purchase. Please check the form errors.' });
        } else {
          setAlert({ type: 'error', message: 'An unexpected error occurred.' });
        }
      })
      .finally(() => setSaving(false));
  };

  const handleArchive = () => {
    setSaving(true);
    archivePurchase(id)
      .then(() => navigate('/purchases'))
      .catch(err => {
        setAlert({ type: 'error', message: 'Failed to archive.' });
        setSaving(false);
      });
  };

  if (loading) return <div className="page-content loading-state"><span className="spinner" /> Loading…</div>;

  return (
    <div className="page-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/purchases')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Purchases
      </button>

      <PageHeader
        title={isNew ? 'Add Purchase' : `Purchase ${purchase.purchase_order_no || `#${purchase.id}`}`}
        description={!isNew ? `Recorded on ${new Date(purchase.purchase_date).toLocaleDateString()}` : null}
        action={
          !isNew && !editing && purchase.is_active && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Edit2 size={16} /> Edit
            </button>
          )
        }
      />

      {alert && <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem' }}>{alert.message}</div>}
      
      {!isNew && !purchase.is_active && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>This purchase is archived and cannot be edited.</div>
      )}

      {editing ? (
        <form className="card" onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* PURCHASE DETAILS */}
            <div>
              <h2 className="section-title">Purchase Details</h2>
              <div className="form-grid">
                <FormField type="date" label="Purchase Date" name="purchase_date" id="purchase_date" value={form.purchase_date} onChange={handleChange} required error={errors.purchase_date} />
                
                <div className="form-field">
                  <label htmlFor="supplier">Supplier <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                      name="supplier" 
                      id="supplier" 
                      className="form-input" 
                      value={form.supplier} 
                      onChange={handleChange} 
                      required 
                      style={{ flex: 1 }}
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowSupplierModal(true)} title="Add New Supplier">
                      <Plus size={16} />
                    </button>
                  </div>
                  {errors.supplier && <div className="error-msg">{errors.supplier}</div>}
                </div>

                <FormField label="Purchase Order No." name="purchase_order_no" id="purchase_order_no" value={form.purchase_order_no} onChange={handleChange} error={errors.purchase_order_no} placeholder="e.g. PO-1025" />
                <FormField label="Serial No." name="serial_no" id="serial_no" value={form.serial_no} onChange={handleChange} error={errors.serial_no} placeholder="e.g. SN-001" />
              </div>
            </div>

            {/* DELIVERY DETAILS */}
            <div>
              <h2 className="section-title">Delivery Details</h2>
              <div className="form-grid">
                <FormField label="Truck No." name="truck_no" id="truck_no" value={form.truck_no} onChange={handleChange} error={errors.truck_no} placeholder="e.g. AP 40 XY 1234" />
                <FormField type="number" step="0.001" min="0.001" label="Coal Quantity (Tons)" name="quantity_tons" id="quantity_tons" value={form.quantity_tons} onChange={handleChange} required error={errors.quantity_tons} placeholder="Enter quantity in tons" />
              </div>
            </div>

            {/* PRICING */}
            <div>
              <h2 className="section-title">Pricing</h2>
              <div className="form-grid" style={{ alignItems: 'flex-start' }}>
                <FormField type="number" step="0.01" min="0" label="Rate per Ton" name="rate_per_ton" id="rate_per_ton" value={form.rate_per_ton} onChange={handleChange} required error={errors.rate_per_ton} placeholder="Enter rate per ton" />
                
                <div className="form-field">
                  <label>Purchase Amount</label>
                  <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border)', color: computed.purchase_amount === null ? 'var(--color-text-muted)' : 'inherit' }}>
                    {computed.purchase_amount === null ? 'Enter quantity and rate' : formatCurrency(computed.purchase_amount)}
                  </div>
                </div>

                <FormField type="number" step="0.01" min="0" label="GST Rate (%)" name="gst_rate" id="gst_rate" value={form.gst_rate} onChange={handleChange} error={errors.gst_rate} placeholder="Enter GST rate" />
                
                <div className="form-field">
                  <label>GST Amount</label>
                  <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border)', color: computed.gst_amount === null ? 'var(--color-text-muted)' : 'inherit' }}>
                    {computed.gst_amount === null ? 'Enter quantity and rate' : formatCurrency(computed.gst_amount)}
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
              <h2 className="section-title">Additional Information</h2>
              <FormField label="Notes" name="notes" id="notes" as="textarea" value={form.notes} onChange={handleChange} error={errors.notes} />
            </div>

          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            {!isNew && <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setErrors({}); setAlert(null); }}>Cancel</button>}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <><Save size={16} /> Save Purchase</>}
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* VIEW MODE */}
            <div>
              <h2 className="section-title">Purchase Details</h2>
              <div className="form-grid">
                <div className="detail-row"><span className="detail-label">Supplier</span><span className="detail-value">{purchase.supplier_name}</span></div>
                <div className="detail-row"><span className="detail-label">Purchase Date</span><span className="detail-value">{new Date(purchase.purchase_date).toLocaleDateString()}</span></div>
                <div className="detail-row"><span className="detail-label">Purchase Order No.</span><span className="detail-value">{purchase.purchase_order_no || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Serial No.</span><span className="detail-value">{purchase.serial_no || '—'}</span></div>
              </div>
            </div>

            <div>
              <h2 className="section-title">Delivery Details</h2>
              <div className="form-grid">
                <div className="detail-row"><span className="detail-label">Truck No.</span><span className="detail-value">{purchase.truck_no || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Quantity</span><span className="detail-value">{Number(purchase.quantity_tons).toLocaleString()} MT</span></div>
              </div>
            </div>

            <div>
              <h2 className="section-title">Pricing</h2>
              <div className="form-grid">
                <div className="detail-row"><span className="detail-label">Rate per Ton</span><span className="detail-value">{formatCurrency(purchase.rate_per_ton)} / MT</span></div>
                <div className="detail-row"><span className="detail-label">Purchase Value</span><span className="detail-value">{formatCurrency(purchase.purchase_amount)}</span></div>
                <div className="detail-row"><span className="detail-label">GST ({Number(purchase.gst_rate)}%)</span><span className="detail-value">{formatCurrency(purchase.gst_amount)}</span></div>
                <div className="detail-row"><span className="detail-label">Total Amount</span><span className="detail-value" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatCurrency(purchase.total_amount)}</span></div>
              </div>
            </div>

            {purchase.notes && (
              <div>
                <h2 className="section-title">Notes</h2>
                <p style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)' }}>{purchase.notes}</p>
              </div>
            )}
            
            {purchase.is_active && (
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                {confirmArchive ? (
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Are you sure you want to delete/archive this purchase?</span>
                    <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleArchive}>
                      {saving ? <span className="spinner" /> : 'Yes, Archive'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmArchive(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmArchive(true)}>
                    Archive Purchase
                  </button>
                )}
              </div>
            )}
            
          </div>
        </div>
      )}
      
      <AddSupplierModal 
        isOpen={showSupplierModal} 
        onClose={() => setShowSupplierModal(false)} 
        onCreated={(newSupplier) => {
          setSuppliers(prev => [...prev, newSupplier]);
          setForm(prev => ({ ...prev, supplier: newSupplier.id }));
        }} 
      />
    </div>
  );
}
