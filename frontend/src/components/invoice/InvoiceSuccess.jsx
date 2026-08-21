import { useNavigate } from 'react-router-dom';

/**
 * InvoiceSuccess — displayed after a successful invoice creation.
 *
 * Props:
 *   invoice  — the invoice object returned by the API
 *   onReset  — callback to reset the form for creating another invoice
 */
export default function InvoiceSuccess({ invoice, onReset }) {
  const navigate = useNavigate();

  const fmtINR = (amount) =>
    '₹\u00A0' + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="page-content">
      {/* Success banner */}
      <div style={{
        background: 'var(--color-success-soft)',
        border: '1px solid var(--color-success)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-10) var(--space-8)',
        textAlign: 'center',
        marginBottom: 'var(--space-8)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>✓</div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
          Invoice Created Successfully
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          The invoice has been saved to the database.
        </p>
      </div>

      {/* Invoice summary card */}
      <div className="card" style={{ maxWidth: '520px', margin: '0 auto var(--space-8)' }}>
        <div className="card-title">Invoice Details</div>
        {[
          ['Invoice Number', invoice.invoice_number],
          ['Invoice Date',   invoice.invoice_date],
          ['Customer',       invoice.customer?.name],
          ['Transaction',    invoice.transaction_type],
          ['Status',         invoice.status],
        ].map(([label, value]) => (
          <div className="detail-row" key={label}>
            <span className="detail-label">{label}</span>
            <span className="detail-value">{value || '—'}</span>
          </div>
        ))}

        {/* Totals */}
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
          {[
            ['Taxable Amount',  invoice.taxable_amount],
            [`CGST (${invoice.cgst_rate}%)`,   invoice.cgst_amount],
            [`SGST (${invoice.sgst_rate}%)`,   invoice.sgst_amount],
            [`IGST (${invoice.igst_rate}%)`,   invoice.igst_amount],
            [`TCS (${invoice.tcs_rate}%)`,     invoice.tcs_amount],
          ].map(([label, amt]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
              <span style={{ fontFamily: 'monospace' }}>{fmtINR(amt)}</span>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '2px solid var(--color-primary)' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Total Amount</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
              {fmtINR(invoice.total_amount)}
            </span>
          </div>
        </div>

        {/* Amount in words */}
        {invoice.amount_in_words && (
          <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
            {invoice.amount_in_words}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary btn-lg"
          id="view-invoice-btn"
          onClick={() => navigate(`/invoices/${invoice.id}`)}
        >
          View Invoice
        </button>
        <button
          className="btn btn-primary btn-lg"
          id="create-another-invoice-btn"
          onClick={onReset}
        >
          + Create Another Invoice
        </button>
      </div>
    </div>
  );
}
