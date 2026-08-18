import FormField from '../FormField';

/**
 * InvoiceInfoSection — Invoice number, date, and transaction type.
 *
 * Props:
 *   data      { invoice_number, invoice_date, transaction_type }
 *   errors    { invoice_number?, invoice_date?, transaction_type? }
 *   onChange  (fieldName, value) => void
 */
export default function InvoiceInfoSection({ data, errors, onChange }) {
  return (
    <div className="card">
      <div className="card-title">Invoice Information</div>
      <div className="form-grid">

        <FormField
          label="Invoice Number"
          name="invoice_number"
          id="invoice_number"
          required
          value={data.invoice_number}
          onChange={(e) => onChange('invoice_number', e.target.value)}
          error={errors.invoice_number}
          placeholder="e.g. 93, INV-93, 2026/93"
        />

        <FormField
          label="Invoice Date"
          name="invoice_date"
          id="invoice_date"
          type="date"
          required
          value={data.invoice_date}
          onChange={(e) => onChange('invoice_date', e.target.value)}
          error={errors.invoice_date}
        />

        {/* Transaction Type — radio buttons */}
        <div className="form-field">
          <label className="form-label">
            Transaction Type<span className="required">*</span>
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-1)' }}>
            {['CASH', 'CREDIT'].map((type) => (
              <label
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  color: data.transaction_type === type
                    ? 'var(--color-primary)'
                    : 'var(--color-text-muted)',
                  fontWeight: data.transaction_type === type ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="transaction_type"
                  value={type}
                  checked={data.transaction_type === type}
                  onChange={() => onChange('transaction_type', type)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
          {errors.transaction_type && (
            <p className="form-error">{errors.transaction_type}</p>
          )}
        </div>

      </div>
    </div>
  );
}
