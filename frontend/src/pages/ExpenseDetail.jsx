import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExpense, createExpense, updateExpense, archiveExpense } from '../api/expenses';
import { getCustomers } from '../api/customers';
import { getSuppliers } from '../api/suppliers';
import { getPurchases } from '../api/purchases';
import { getSales } from '../api/sales';
import { EXPENSE_CATEGORIES } from './Expenses';
import { Trash2, Archive, Save, ArrowLeft, ExternalLink } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/StatusBadge';

export default function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [expense, setExpense] = useState(null);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  
  // Relations
  const [supplierId, setSupplierId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [saleId, setSaleId] = useState('');

  // Dropdown options
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    // Fetch dropdowns
    Promise.all([
      getSuppliers({ no_page: true }),
      getCustomers({ no_page: true }),
      getPurchases({ no_page: true }),
      getSales({ no_page: true })
    ]).then(([supRes, custRes, purRes, salRes]) => {
      setSuppliers(supRes.data.results || supRes.data);
      setCustomers(custRes.data.results || custRes.data);
      setPurchases(purRes.data.results || purRes.data);
      setSales(salRes.data.results || salRes.data);
    }).catch(console.error);

    if (isNew) return;

    setLoading(true);
    getExpense(id)
      .then(res => {
        const data = res.data;
        setExpense(data);
        setDate(data.expense_date);
        setCategory(data.category);
        setDescription(data.description);
        setAmount(data.amount);
        setPaidTo(data.paid_to);
        setReferenceNo(data.reference_no);
        setNotes(data.notes);
        setSupplierId(data.supplier || '');
        setCustomerId(data.customer || '');
        setPurchaseId(data.purchase || '');
        setSaleId(data.sale || '');
      })
      .catch(() => setError('Failed to load expense.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!date || !category || !description || !amount) {
      setError('Date, Category, Description, and Amount are required.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      expense_date: date,
      category,
      description,
      amount,
      paid_to: paidTo,
      reference_no: referenceNo,
      notes,
      supplier: supplierId || null,
      customer: customerId || null,
      purchase: purchaseId || null,
      sale: saleId || null,
    };

    try {
      if (isNew) {
        const res = await createExpense(payload);
        navigate(`/expenses/${res.data.id}`);
      } else {
        const res = await updateExpense(id, payload);
        setExpense(res.data);
        alert('Expense updated successfully.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm("Are you sure you want to archive this expense?")) return;
    try {
      await archiveExpense(id);
      navigate('/expenses');
    } catch (err) {
      setError("Failed to archive expense.");
    }
  };

  if (loading) return <div className="loading-state"><span className="spinner" /> Loading expense...</div>;

  return (
    <div className="page-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/expenses')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Expenses
      </button>

      <PageHeader
        title={isNew ? 'Add New Expense' : `Expense Details`}
        action={
          !isNew && expense && (
            <StatusBadge active={expense.is_active} activeText="RECORDED" inactiveText="ARCHIVED" />
          )
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSave}>
        <div className="card">
          <div className="card-title">Expense Details</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Expense Date <span className="required">*</span></label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            
            <div className="form-group">
              <label>Category <span className="required">*</span></label>
              <select className="form-input" value={category} onChange={e => setCategory(e.target.value)} required>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description <span className="required">*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Truck transportation from mine" value={description} onChange={e => setDescription(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Amount (₹) <span className="required">*</span></label>
              <input type="number" step="0.01" min="0.01" className="form-input" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value)} onWheel={(e) => e.target.blur()} required />
            </div>

            <div className="form-group">
              <label>Paid To (Optional)</label>
              <input type="text" className="form-input" placeholder="e.g. ABC Transport" value={paidTo} onChange={e => setPaidTo(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label>Reference No. (Optional)</label>
              <input type="text" className="form-input" placeholder="e.g. TR-2026-008" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-title">Optional Business Relationships</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Link this expense to a specific business record. (Does not modify the linked record)
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>Related Supplier</label>
              <select className="form-input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— None —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Related Customer</label>
              <select className="form-input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">— None —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Related Purchase</label>
              <select className="form-input" value={purchaseId} onChange={e => setPurchaseId(e.target.value)}>
                <option value="">— None —</option>
                {purchases.map(p => <option key={p.id} value={p.id}>PO-{p.id} ({p.supplier_name})</option>)}
              </select>
              {purchaseId && !isNew && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => navigate(`/purchases/${purchaseId}`)}>
                  <ExternalLink size={14} /> View Purchase
                </button>
              )}
            </div>
            <div className="form-group">
              <label>Related Sale</label>
              <select className="form-input" value={saleId} onChange={e => setSaleId(e.target.value)}>
                <option value="">— None —</option>
                {sales.map(s => <option key={s.id} value={s.id}>SO-{s.id} ({s.customer_name})</option>)}
              </select>
              {saleId && !isNew && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => navigate(`/sales/${saleId}`)}>
                  <ExternalLink size={14} /> View Sale
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-title">Notes</div>
          <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Expense'}
          </button>
          
          {!isNew && expense?.is_active && (
            <button type="button" className="btn btn-danger" onClick={handleArchive}>
              <Trash2 size={16} /> Archive Expense
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
