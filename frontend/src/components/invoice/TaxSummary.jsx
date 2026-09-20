import React from 'react';
import FormField from '../FormField';

function fmtINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TaxSummary({ business, customer, taxableAmount, data, errors, onChange }) {
  const gstRate = parseFloat(data.gst_rate) || 0;
  const tcsRate = parseFloat(data.tcs_rate) || 0;
  
  const bState = business?.state?.trim() || null;
  const cState = customer?.state?.trim() || null;
  
  const isComplete = bState && cState;
  const isIntra = bState && cState && bState.toLowerCase() === cState.toLowerCase();
  
  const gstAmt = (taxableAmount * gstRate) / 100;
  const cgstAmt = isIntra ? gstAmt / 2 : 0;
  const sgstAmt = isIntra ? gstAmt / 2 : 0;
  const igstAmt = !isIntra ? gstAmt : 0;
  const tcsAmt = (taxableAmount * tcsRate) / 100;

  return (
    <div className="card">
      <div className="card-title">Tax Summary</div>

      {!business?.state && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          Business state is required to determine GST. Please update your Business Profile.
        </div>
      )}
      {customer && !customer.state && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          Customer state is required to determine GST. Please update the customer.
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Seller State</h4>
          <div style={{ fontWeight: '500' }}>
            {bState ? `${bState} (${business?.state_code || ''})` : <span style={{ color: 'var(--color-danger)' }}>Missing</span>}
          </div>
        </div>
        <div>
          <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Customer State</h4>
          <div style={{ fontWeight: '500' }}>
            {!customer ? <span style={{ color: 'var(--color-text-faint)' }}>Select customer...</span> : 
              cState ? `${cState} (${customer?.state_code || ''})` : <span style={{ color: 'var(--color-danger)' }}>Missing</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Transaction Type</h4>
          <div style={{ fontWeight: '500' }}>
            {!isComplete ? '—' : isIntra ? 'Intra-State' : 'Inter-State'}
          </div>
        </div>
        <div>
          <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>GST Type Applied</h4>
          <div style={{ fontWeight: '500', color: 'var(--color-primary-light)' }}>
            {!isComplete ? '—' : isIntra ? 'CGST + SGST applied automatically' : 'IGST applied automatically'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', alignItems: 'end' }}>
        <div className="form-field">
          <label htmlFor="gst_rate">GST Rate (%)</label>
          <div className="input-group">
            <input
              type="number"
              id="gst_rate"
              name="gst_rate"
              placeholder="Rate"
              value={data.gst_rate}
              onChange={onChange}
              onWheel={(e) => e.target.blur()}
              className={`form-input ${errors.gst_rate ? 'error' : ''}`}
              style={{ fontSize: '1.25rem', fontWeight: 'bold' }}
              min="0"
              max="100"
              step="0.01"
            />
            <span className="input-suffix">%</span>
          </div>
          {errors.gst_rate && <div className="error-msg">{errors.gst_rate}</div>}
        </div>
        
        <div className="form-field">
          <label htmlFor="tcs_rate">TCS Rate (%)</label>
          <div className="input-group">
            <input
              type="number"
              id="tcs_rate"
              name="tcs_rate"
              placeholder="Rate"
              value={data.tcs_rate}
              onChange={onChange}
              onWheel={(e) => e.target.blur()}
              className={`form-input ${errors.tcs_rate ? 'error' : ''}`}
              style={{ fontSize: '1.25rem', fontWeight: 'bold' }}
              min="0"
              max="100"
              step="0.01"
            />
            <span className="input-suffix">%</span>
          </div>
          {errors.tcs_rate && <div className="error-msg">{errors.tcs_rate}</div>}
        </div>
      </div>
      
      <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--color-surface-hover)', borderRadius: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-4)' }}>
          {isIntra && (
            <>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>CGST ({gstRate/2}%)</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>{fmtINR(cgstAmt)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>SGST ({gstRate/2}%)</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>{fmtINR(sgstAmt)}</div>
              </div>
            </>
          )}
          {!isIntra && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>IGST ({gstRate}%)</div>
              <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>{isComplete ? fmtINR(igstAmt) : '—'}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>TCS ({tcsRate}%)</div>
            <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>{tcsRate > 0 ? fmtINR(tcsAmt) : '—'}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
