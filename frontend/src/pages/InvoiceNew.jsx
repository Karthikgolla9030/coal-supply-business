import { useState, useCallback } from 'react';
import InvoiceInfoSection from '../components/invoice/InvoiceInfoSection';
import TransportSection from '../components/invoice/TransportSection';
import CustomerSelector from '../components/invoice/CustomerSelector';
import InvoiceItemsSection, { EMPTY_ITEM } from '../components/invoice/InvoiceItemsSection';
import TaxSection from '../components/invoice/TaxSection';
import InvoiceSummary from '../components/invoice/InvoiceSummary';
import InvoiceSuccess from '../components/invoice/InvoiceSuccess';
import { createInvoice } from '../api/invoices';

/* ── Initial form state ─────────────────────────────────────── */
function freshForm() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for <input type="date">
  return {
    invoice_number:   '',
    invoice_date:     today,
    transaction_type: 'CASH',
    transport_name:   '',
    vehicle_number:   '',
    cgst_rate:        '0.00',
    sgst_rate:        '0.00',
    igst_rate:        '0.00',
    tcs_rate:         '0.00',
    reverse_charge:   false,
  };
}

/* ── Error extraction from DRF response ─────────────────────── */
function extractErrors(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = Array.isArray(v) ? v[0] : (typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
}

/* ── Taxable amount from items ──────────────────────────────── */
function calcTaxable(items) {
  return items.reduce((acc, item) => {
    const q = parseFloat(item.quantity);
    const r = parseFloat(item.rate);
    if (!isNaN(q) && !isNaN(r) && q >= 0 && r >= 0) return acc + q * r;
    return acc;
  }, 0);
}

/* ── Main page ──────────────────────────────────────────────── */
export default function InvoiceNew() {
  const [form, setForm] = useState(freshForm());
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [errors, setErrors] = useState({});
  const [itemErrors, setItemErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [topAlert, setTopAlert] = useState(null);
  const [createdInvoice, setCreatedInvoice] = useState(null);

  /* ── Derived ───────────────────────────────────────────────── */
  const taxableAmount = calcTaxable(items);

  /* ── Handlers ──────────────────────────────────────────────── */
  const handleFormChange = useCallback((field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  }, [errors]);

  const handleItemChange = useCallback((idx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    // Clear that item's field error
    if (itemErrors[idx]?.[field]) {
      setItemErrors((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], [field]: undefined };
        return next;
      });
    }
  }, [itemErrors]);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    setItemErrors((prev) => [...prev, {}]);
  }, []);

  const handleRemoveItem = useCallback((idx) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setItemErrors((prev) => prev.filter((_, i) => i !== idx));
  }, [items.length]);

  /* ── Frontend validation ────────────────────────────────────── */
  function validateFrontend() {
    const errs = {};
    const iErrs = items.map(() => ({}));
    let valid = true;

    if (!form.invoice_number.trim()) { errs.invoice_number = 'Invoice number is required.'; valid = false; }
    if (!form.invoice_date)          { errs.invoice_date   = 'Invoice date is required.';   valid = false; }
    if (!form.transaction_type)      { errs.transaction_type = 'Select a transaction type.'; valid = false; }
    if (!selectedCustomer)           { errs.customer = 'Please select a customer.';         valid = false; }

    const taxRates = ['cgst_rate', 'sgst_rate', 'igst_rate', 'tcs_rate'];
    for (const key of taxRates) {
      const v = parseFloat(form[key]);
      if (isNaN(v) || v < 0) { errs[key] = 'Must be 0 or greater.'; valid = false; }
    }

    items.forEach((item, idx) => {
      if (!item.product_name.trim()) { iErrs[idx].product_name = 'Product name is required.'; valid = false; }
      const q = parseFloat(item.quantity);
      if (isNaN(q) || q <= 0)        { iErrs[idx].quantity = 'Quantity must be greater than 0.'; valid = false; }
      const r = parseFloat(item.rate);
      if (isNaN(r) || r < 0)         { iErrs[idx].rate = 'Rate cannot be negative.'; valid = false; }
    });

    setErrors(errs);
    setItemErrors(iErrs);
    return valid;
  }

  /* ── Submit ─────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setTopAlert(null);

    if (!validateFrontend()) {
      setTopAlert({ type: 'error', message: 'Please fix the errors highlighted below before saving.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      customer: selectedCustomer.id,
      items: items.map((item) => ({
        product_name: item.product_name.trim(),
        hsn_code:     item.hsn_code.trim(),
        quantity:     item.quantity,
        unit:         item.unit,
        rate:         item.rate,
      })),
    };

    try {
      const res = await createInvoice(payload);
      setCreatedInvoice(res.data.invoice);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data) {
        const serverErrors = extractErrors(data);
        // Check if items errors come back as an array
        if (Array.isArray(data.items)) {
          setItemErrors(data.items.map((ie) => ie || {}));
        }
        setErrors(serverErrors);
        setTopAlert({ type: 'error', message: serverErrors.non_field_errors || serverErrors.detail || 'Please fix the errors highlighted below.' });
      } else {
        setTopAlert({ type: 'error', message: data?.detail || 'Failed to save invoice. Please try again.' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Reset for "Create Another" ─────────────────────────────── */
  const handleReset = () => {
    setCreatedInvoice(null);
    setForm(freshForm());
    setSelectedCustomer(null);
    setItems([{ ...EMPTY_ITEM }]);
    setErrors({});
    setItemErrors([]);
    setTopAlert(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Success screen ─────────────────────────────────────────── */
  if (createdInvoice) {
    return <InvoiceSuccess invoice={createdInvoice} onReset={handleReset} />;
  }

  /* ── Form ───────────────────────────────────────────────────── */
  return (
    <div className="page-content" style={{ maxWidth: '960px' }}>

      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Create New Invoice</h1>
        <p className="page-subtitle">Fill in all required fields and save to generate the invoice record.</p>
      </div>

      {/* Top alert */}
      {topAlert && (
        <div className={`alert alert-${topAlert.type}`}>
          {topAlert.type === 'error' ? '✕ ' : '✓ '}{topAlert.message}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* 1. Invoice Information */}
        <InvoiceInfoSection
          data={form}
          errors={errors}
          onChange={handleFormChange}
        />

        {/* 2. Transport Information */}
        <TransportSection
          data={form}
          errors={errors}
          onChange={handleFormChange}
        />

        {/* 3. Customer Selection */}
        <CustomerSelector
          selected={selectedCustomer}
          onSelect={setSelectedCustomer}
          error={errors.customer}
        />

        {/* 4. Product Details */}
        <InvoiceItemsSection
          items={items}
          errors={itemErrors}
          onChange={handleItemChange}
          onAdd={handleAddItem}
          onRemove={handleRemoveItem}
        />

        {/* 5. Tax Details */}
        <TaxSection
          taxableAmount={taxableAmount}
          data={form}
          errors={errors}
          onChange={handleFormChange}
        />

        {/* 6. Invoice Summary */}
        <InvoiceSummary
          taxableAmount={taxableAmount}
          cgstRate={form.cgst_rate}
          sgstRate={form.sgst_rate}
          igstRate={form.igst_rate}
          tcsRate={form.tcs_rate}
        />

        {/* 7. Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-4)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={handleReset}
            disabled={saving}
          >
            Clear Form
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={saving}
            id="save-invoice-btn"
          >
            {saving
              ? <><span className="spinner" /> Saving Invoice…</>
              : '💾 Save Invoice'
            }
          </button>
        </div>

      </form>
    </div>
  );
}
