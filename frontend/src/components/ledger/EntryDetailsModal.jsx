import React, { useState, useEffect } from 'react';
import { X, Calendar, Wallet } from 'lucide-react';
import { ledgerApi } from '../../api/ledger';

export default function EntryDetailsModal({ isOpen, onClose, ledgerEntry, onRecordPaymentClick }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && ledgerEntry) {
      fetchPayments();
    }
  }, [isOpen, ledgerEntry]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await ledgerApi.getLedgerPayments(ledgerEntry.id);
      if (res.results) {
        setPayments(res.results);
      }
    } catch (err) {
      console.error("Failed to fetch payments", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !ledgerEntry) return null;

  const originalAmount = parseFloat(ledgerEntry.amount);
  const paidAmount = parseFloat(ledgerEntry.paid_amount || ledgerEntry.amount - ledgerEntry.remaining_amount || 0); // fallback
  const remainingAmount = parseFloat(ledgerEntry.remaining_amount || originalAmount - paidAmount);

  // Status mapping to colors
  const statusColors = {
    PENDING: { bg: '#fee2e2', text: '#b91c1c' },
    PARTIALLY_PAID: { bg: '#fef3c7', text: '#b45309' },
    PAID: { bg: '#dcfce3', text: '#166534' }
  };
  
  const statusDisplay = {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY PAID',
    PAID: 'PAID'
  };

  const statusStyle = statusColors[ledgerEntry.status] || statusColors.PENDING;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: '600px', width: '100%' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ marginBottom: '0.25rem' }}>{ledgerEntry.party_name || ledgerEntry.customer_name || "Unknown Party"}</h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              {ledgerEntry.transaction_type === 'RECEIVABLE' ? 'Money to Receive' : 'Money to Pay'}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Original Amount</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>₹{originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Paid</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-success)' }}>₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Remaining</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', color: remainingAmount > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Status</div>
              <div style={{ 
                display: 'inline-block',
                padding: '0.25rem 0.5rem', 
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: statusStyle.bg,
                color: statusStyle.text
              }}>
                {statusDisplay[ledgerEntry.status] || ledgerEntry.status}
              </div>
            </div>
          </div>

          {(ledgerEntry.reference || ledgerEntry.notes) && (
            <div style={{ marginBottom: '2rem' }}>
              {ledgerEntry.reference && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '500', marginRight: '0.5rem' }}>Reference:</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{ledgerEntry.reference}</span>
                </div>
              )}
              {ledgerEntry.notes && (
                <div>
                  <span style={{ fontWeight: '500', marginRight: '0.5rem' }}>Notes:</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{ledgerEntry.notes}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Payment History</h3>
            {remainingAmount > 0 && (
              <button 
                className="btn btn-sm btn-primary"
                onClick={() => {
                  onClose();
                  if (onRecordPaymentClick) onRecordPaymentClick(ledgerEntry);
                }}
              >
                Record Payment
              </button>
            )}
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Loading payments...</div>
            ) : payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem' }}>
                No payments recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {payments.map(payment => {
                  // Format date e.g. "21 Aug 2026"
                  const dateObj = new Date(payment.payment_date);
                  const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                  
                  return (
                    <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          <Calendar size={14} />
                          <span>{dateStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          <Wallet size={14} />
                          <span>{payment.payment_method.replace('_', ' ')}</span>
                        </div>
                        {payment.notes && (
                          <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {payment.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-success)' }}>
                        ₹{parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
