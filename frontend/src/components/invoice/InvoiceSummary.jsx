/**
 * InvoiceSummary — displays the computed invoice totals.
 *
 * Props:
 *   taxableAmount  number
 *   cgstRate       string/number
 *   sgstRate       string/number
 *   igstRate       string/number
 *   tcsRate        string/number
 */

function fmtINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return '₹\u00A0' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTax(base, rateStr) {
  const r = parseFloat(rateStr);
  if (isNaN(r) || r < 0) return 0;
  return (base * r) / 100;
}

export default function InvoiceSummary({ taxableAmount, gstRate, tcsRate, isIntra }) {
  const base = isNaN(taxableAmount) ? 0 : taxableAmount;
  const rate = parseFloat(gstRate) || 0;
  
  const cgst = isIntra ? calcTax(base, rate / 2) : 0;
  const sgst = isIntra ? calcTax(base, rate / 2) : 0;
  const igst = !isIntra ? calcTax(base, rate) : 0;
  const tcs  = calcTax(base, tcsRate);
  const total = base + cgst + sgst + igst + tcs;

  const rows = [
    { label: 'Taxable Amount', value: base,  highlight: false, show: true },
    { label: `CGST (${rate/2}%)`, value: cgst,  highlight: false, show: isIntra },
    { label: `SGST (${rate/2}%)`, value: sgst,  highlight: false, show: isIntra },
    { label: `IGST (${rate}%)`, value: igst,  highlight: false, show: !isIntra },
    { label: `TCS (${tcsRate || 0}%)`, value: tcs, highlight: false, show: true },
  ];

  return (
    <div className="card">
      <div className="card-title">Invoice Summary</div>

      <div style={{ maxWidth: '420px', marginLeft: 'auto' }}>
        {rows.filter(r => r.show).map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: 'var(--space-3) 0',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-sm)',
          }}>
            <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{fmtINR(value)}</span>
          </div>
        ))}

        {/* Grand Total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: 'var(--space-4) 0 var(--space-2)',
          borderTop: '2px solid var(--color-primary)',
          marginTop: 'var(--space-2)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
            Total Amount
          </span>
          <span style={{
            fontWeight: 700,
            fontSize: 'var(--font-size-xl)',
            color: 'var(--color-primary)',
            fontFamily: 'monospace',
          }}>
            {fmtINR(total)}
          </span>
        </div>

        <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', textAlign: 'right' }}>
          Preview only — server calculates authoritative values on save.
        </p>
      </div>
    </div>
  );
}
