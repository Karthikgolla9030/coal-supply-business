import { useCallback } from 'react';
import FormField from '../FormField';
import { Plus, X } from 'lucide-react';

const UNIT_OPTIONS = ['MT', 'KG', 'TON', 'QTL', 'NOS'];

const EMPTY_ITEM = {
  product_name: '',
  hsn_code: '',
  quantity: '',
  unit: 'MT',
  rate: '',
};

/**
 * Format a number as Indian Rupees for display.
 * Frontend-only — for UX feedback. Backend recalculates authoritatively.
 */
function displayAmount(qty, rate) {
  const q = parseFloat(qty);
  const r = parseFloat(rate);
  if (!isNaN(q) && !isNaN(r) && q >= 0 && r >= 0) {
    const amt = q * r;
    return '₹' + amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '—';
}

/**
 * InvoiceItemsSection — dynamic table of invoice line items.
 *
 * Props:
 *   items     array of item objects
 *   errors    array of error objects (same index as items), or top-level string
 *   onChange  (index, fieldName, value) => void
 *   onAdd     () => void
 *   onRemove  (index) => void
 */
export default function InvoiceItemsSection({ items, errors, onChange, onAdd, onRemove }) {
  const getItemError = (index, field) => {
    if (Array.isArray(errors) && errors[index]) return errors[index][field];
    return null;
  };

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Product Details</span>
        <button type="button" className="btn btn-secondary btn-sm" id="add-item-btn" onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* Top-level items error (e.g. "At least one item required") */}
      {typeof errors === 'string' && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{errors}</div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)' }}>
              {['Sl', 'Product Name *', 'HSN Code', 'Qty *', 'Unit', 'Rate (₹) *', 'Amount (₹)', ''].map((h) => (
                <th key={h} style={{
                  padding: 'var(--space-3) var(--space-3)',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                {/* Serial number */}
                <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)', width: '40px', textAlign: 'center' }}>
                  {idx + 1}
                </td>

                {/* Product name */}
                <td style={{ padding: 'var(--space-2) var(--space-2)', minWidth: '160px' }}>
                  <input
                    className={`form-input${getItemError(idx, 'product_name') ? ' error' : ''}`}
                    type="text"
                    placeholder="e.g. Coal"
                    value={item.product_name}
                    onChange={(e) => onChange(idx, 'product_name', e.target.value)}
                    id={`item_${idx}_product`}
                  />
                  {getItemError(idx, 'product_name') && (
                    <p className="form-error">{getItemError(idx, 'product_name')}</p>
                  )}
                </td>

                {/* HSN code */}
                <td style={{ padding: 'var(--space-2)', minWidth: '100px' }}>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="2701"
                    value={item.hsn_code}
                    onChange={(e) => onChange(idx, 'hsn_code', e.target.value)}
                    id={`item_${idx}_hsn`}
                    maxLength={20}
                  />
                </td>

                {/* Quantity */}
                <td style={{ padding: 'var(--space-2)', minWidth: '90px' }}>
                  <input
                    className={`form-input${getItemError(idx, 'quantity') ? ' error' : ''}`}
                    type="number"
                    placeholder="0.00"
                    step="0.001"
                    min="0.001"
                    value={item.quantity}
                    onChange={(e) => onChange(idx, 'quantity', e.target.value)}
                    id={`item_${idx}_qty`}
                  />
                  {getItemError(idx, 'quantity') && (
                    <p className="form-error">{getItemError(idx, 'quantity')}</p>
                  )}
                </td>

                {/* Unit */}
                <td style={{ padding: 'var(--space-2)', minWidth: '80px' }}>
                  <select
                    className="form-input"
                    value={item.unit}
                    onChange={(e) => onChange(idx, 'unit', e.target.value)}
                    id={`item_${idx}_unit`}
                    style={{ cursor: 'pointer' }}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </td>

                {/* Rate */}
                <td style={{ padding: 'var(--space-2)', minWidth: '110px' }}>
                  <input
                    className={`form-input${getItemError(idx, 'rate') ? ' error' : ''}`}
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={item.rate}
                    onChange={(e) => onChange(idx, 'rate', e.target.value)}
                    id={`item_${idx}_rate`}
                  />
                  {getItemError(idx, 'rate') && (
                    <p className="form-error">{getItemError(idx, 'rate')}</p>
                  )}
                </td>

                {/* Calculated amount — frontend UX only */}
                <td style={{
                  padding: 'var(--space-3)',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  minWidth: '120px',
                }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', display: 'block', marginBottom: '2px' }}>
                    preview
                  </span>
                  {displayAmount(item.quantity, item.rate)}
                </td>

                {/* Remove button */}
                <td style={{ padding: 'var(--space-2)', textAlign: 'center', width: '36px' }}>
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    disabled={items.length <= 1}
                    title="Remove item"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: items.length <= 1 ? 'not-allowed' : 'pointer',
                      color: items.length <= 1 ? 'var(--color-text-faint)' : 'var(--color-danger)',
                      fontSize: '1rem',
                      padding: 'var(--space-1)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'background var(--transition)',
                    }}
                    onMouseEnter={(e) => items.length > 1 && (e.currentTarget.style.background = 'var(--color-danger-soft)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    id={`remove-item-${idx}`}
                  >
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{
        marginTop: 'var(--space-3)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-faint)',
      }}>
        * Amount preview is calculated in the browser for reference only. Final amounts are calculated and validated by the server.
      </p>
    </div>
  );
}

export { EMPTY_ITEM };
