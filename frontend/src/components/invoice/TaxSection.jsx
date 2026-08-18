/**
 * TaxSection — tax rates input and read-only calculated amounts.
 *
 * Props:
 *   taxableAmount  number (sum of item amounts, from parent state)
 *   data           { cgst_rate, sgst_rate, igst_rate, tcs_rate, reverse_charge }
 *   errors         { cgst_rate?, sgst_rate?, igst_rate?, tcs_rate? }
 *   onChange       (fieldName, value) => void
 */

function fmtINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTax(taxableAmount, rateStr) {
  const rate = parseFloat(rateStr);
  if (isNaN(rate) || rate < 0 || isNaN(taxableAmount)) return null;
  return (taxableAmount * rate) / 100;
}

export default function TaxSection({ taxableAmount, data, errors, onChange }) {
  const cgstAmt = calcTax(taxableAmount, data.cgst_rate);
  const sgstAmt = calcTax(taxableAmount, data.sgst_rate);
  const igstAmt = calcTax(taxableAmount, data.igst_rate);
  const tcsAmt  = calcTax(taxableAmount, data.tcs_rate);

  const taxRows = [
    { label: 'CGST',  rateKey: 'cgst_rate',  amount: cgstAmt },
    { label: 'SGST',  rateKey: 'sgst_rate',  amount: sgstAmt },
    { label: 'IGST',  rateKey: 'igst_rate',  amount: igstAmt },
    { label: 'TCS',   rateKey: 'tcs_rate',   amount: tcsAmt  },
  ];

  return (
    <div className="card">
      <div className="card-title">Tax Details</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        {taxRows.map(({ label, rateKey, amount }) => (
          <div key={rateKey} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-3)',
            alignItems: 'end',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: 'var(--space-4)',
          }}>
            {/* Rate input */}
            <div className="form-field">
              <label className="form-label">{label} Rate (%)</label>
              <div style={{ position: 'relative' }}>
                <input
                  className={`form-input${errors[rateKey] ? ' error' : ''}`}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0.00"
                  value={data[rateKey]}
                  onChange={(e) => onChange(rateKey, e.target.value)}
                  id={rateKey}
                />
                <span style={{
                  position: 'absolute',
                  right: 'var(--space-3)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-faint)',
                  fontSize: 'var(--font-size-sm)',
                  pointerEvents: 'none',
                }}>%</span>
              </div>
              {errors[rateKey] && <p className="form-error">{errors[rateKey]}</p>}
            </div>

            {/* Calculated amount — read-only */}
            <div className="form-field">
              <label className="form-label" style={{ color: 'var(--color-text-faint)' }}>
                {label} Amount
              </label>
              <div style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--font-size-sm)',
                color: amount !== null ? 'var(--color-text)' : 'var(--color-text-faint)',
                fontFamily: 'monospace',
              }}>
                {amount !== null ? fmtINR(amount) : '—'}
              </div>
              <p className="form-help">Calculated preview</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reverse Charge */}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-sm)',
        }}>
          <div
            onClick={() => onChange('reverse_charge', !data.reverse_charge)}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              background: data.reverse_charge ? 'var(--color-primary)' : 'var(--color-border)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background var(--transition)',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: '3px',
              left: data.reverse_charge ? '23px' : '3px',
              transition: 'left var(--transition)',
            }} />
          </div>
          <div>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              Reverse Charge
            </span>
            <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
              {data.reverse_charge ? '(Applicable)' : '(Not Applicable)'}
            </span>
          </div>
        </label>
        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', marginLeft: '56px' }}>
          Toggle on if the reverse charge mechanism applies to this invoice.
        </p>
      </div>

      <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)' }}>
        * Tax amounts shown above are browser previews calculated on taxable amount. Final values are calculated and stored by the server.
      </p>
    </div>
  );
}
