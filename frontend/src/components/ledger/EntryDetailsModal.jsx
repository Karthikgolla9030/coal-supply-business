import React, { useState, useEffect } from 'react';
import { X, Calendar, Wallet, FileText, AlertTriangle, Shield, Clock, Image as ImageIcon, ExternalLink, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ledgerApi } from '../../api/ledger';

export default function EntryDetailsModal({ isOpen, onClose, ledgerEntry, onRecordPaymentClick, onUpdate }) {
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Payments'); // 'Payments' or 'Audit'
  const navigate = useNavigate();

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', id: null, message: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [previewProof, setPreviewProof] = useState(null); // URL or object for proof preview
  const [selectedPayment, setSelectedPayment] = useState(null); // specific payment details modal

  useEffect(() => {
    if (isOpen && ledgerEntry) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ledgerEntry]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, auditRes] = await Promise.all([
        ledgerApi.getLedgerPayments(ledgerEntry.id),
        ledgerApi.getLedgerEntryAuditHistory(ledgerEntry.id)
      ]);
      const pData = paymentsRes.data || {};
      const aData = auditRes.data || {};
      setPayments(pData.results || (Array.isArray(pData) ? pData : []));
      setAuditLogs(aData.results || (Array.isArray(aData) ? aData : []));
    } catch (err) {
      console.error("Failed to fetch ledger data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async () => {
    try {
      setActionLoading(true);
      if (confirmModal.type === 'ENTRY') {
        await ledgerApi.voidLedgerEntry(confirmModal.id);
      } else if (confirmModal.type === 'PAYMENT') {
        await ledgerApi.voidLedgerPayment(confirmModal.id);
      }
      setConfirmModal({ isOpen: false, type: '', id: null, message: '' });
      // Notify parent to refresh list, then refresh our internal data
      if (onUpdate) onUpdate();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to void record.");
    } finally {
      setActionLoading(false);
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
    PAID: { bg: '#dcfce3', text: '#166534' },
    VOIDED: { bg: '#e2e8f0', text: '#475569' }
  };
  
  const statusDisplay = {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY PAID',
    PAID: 'PAID',
    VOIDED: 'VOIDED'
  };

  const statusStyle = statusColors[ledgerEntry.status] || statusColors.PENDING;
  const isVoided = ledgerEntry.status === 'VOIDED';

  return (
    <>
      <div className="modal-backdrop">
        <div className="modal" style={{ maxWidth: 'min(750px, calc(100vw - 32px))', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="modal-title" style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', wordBreak: 'break-word', fontSize: '1.25rem' }}>
                {ledgerEntry.party_name || ledgerEntry.customer_name || "Unknown Party"}
                {isVoided && <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '4px', fontWeight: 'bold' }}>VOIDED</span>}
              </h2>
              {ledgerEntry.customer_phone && (
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                  Phone: {ledgerEntry.customer_phone}
                </div>
              )}
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <span>{ledgerEntry.transaction_type === 'RECEIVABLE' ? 'Money to Receive' : 'Money to Pay'}</span>
                {ledgerEntry.truck_no && (
                  <>
                    <span style={{ color: 'var(--color-border)' }}>•</span>
                    <span>Truck No: <span style={{ color: 'var(--color-text)' }}>{ledgerEntry.truck_no}</span></span>
                  </>
                )}
                {ledgerEntry.reference && (
                  <>
                    <span style={{ color: 'var(--color-border)' }}>•</span>
                    <span>Ref: <span style={{ color: 'var(--color-text)' }}>{ledgerEntry.reference}</span></span>
                  </>
                )}
              </div>
            </div>
            <button className="btn-icon" onClick={onClose} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body custom-scrollbar" style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
            
            {(ledgerEntry.sale_order_no || ledgerEntry.purchase_order_no || ledgerEntry.serial_no || ledgerEntry.truck_no || ledgerEntry.entry_date || ledgerEntry.tons) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-bg-subtle)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
                {ledgerEntry.sale_order_no && (
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Sale Order No</div><div style={{ fontWeight: 500 }}>{ledgerEntry.sale_order_no}</div></div>
                )}
                {ledgerEntry.purchase_order_no && (
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Purchase Order No</div><div style={{ fontWeight: 500 }}>{ledgerEntry.purchase_order_no}</div></div>
                )}
                {ledgerEntry.serial_no && (
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Serial No</div><div style={{ fontWeight: 500 }}>{ledgerEntry.serial_no}</div></div>
                )}
                {ledgerEntry.truck_no && (
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Truck No</div><div style={{ fontWeight: 500 }}>{ledgerEntry.truck_no}</div></div>
                )}
                {ledgerEntry.entry_date && (
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Date</div><div style={{ fontWeight: 500 }}>{ledgerEntry.entry_date}</div></div>
                )}
                {ledgerEntry.tons && (
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tons</div><div style={{ fontWeight: 500 }}>{ledgerEntry.tons} MTS</div></div>
                )}
                {ledgerEntry.sale && (
                  <div style={{ display: 'flex', alignItems: 'center', gridColumn: '1 / -1', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { onClose(); navigate(`/sales/${ledgerEntry.sale}`); }}>
                      <ExternalLink size={14} style={{ marginRight: '0.25rem' }} /> View Linked Sale
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Original Amount</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', textDecoration: isVoided ? 'line-through' : 'none', wordBreak: 'break-word', color: 'var(--color-text)' }}>₹{originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Paid</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: isVoided ? 'var(--color-text-muted)' : 'var(--color-success)', wordBreak: 'break-word' }}>₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Remaining</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: (!isVoided && remainingAmount > 0) ? 'var(--color-danger)' : 'var(--color-text-muted)', wordBreak: 'break-word' }}>₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Status</div>
                <div>
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.25rem 0.6rem', 
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                    border: statusStyle.border || 'none',
                    textAlign: 'center',
                    lineHeight: '1.2',
                    maxWidth: '100%',
                    wordBreak: 'break-word'
                  }}>
                    {statusDisplay[ledgerEntry.status] || ledgerEntry.status}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                {ledgerEntry.invoice && (
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClose();
                      navigate(`/invoices/${ledgerEntry.invoice}`);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}
                  >
                    <FileText size={16} /> View Invoice
                  </button>
                )}
                {!isVoided && (
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmModal({
                      isOpen: true,
                      type: 'ENTRY',
                      id: ledgerEntry.id,
                      message: 'Cancelled entries will no longer be included in financial totals, but the record will remain in your history. Are you sure you want to cancel this financial entry?'
                    })}
                  >
                    Cancel Entry
                  </button>
                )}
              </div>
            </div>

            {/* Custom Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem', gap: '1.5rem' }}>
              <button 
                onClick={() => setActiveTab('Payments')}
                style={{
                  background: 'none', border: 'none', padding: '0.5rem 0',
                  fontWeight: activeTab === 'Payments' ? '600' : '400',
                  borderBottom: activeTab === 'Payments' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer', color: activeTab === 'Payments' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Wallet size={16} /> Payments</div>
              </button>
              <button 
                onClick={() => setActiveTab('Audit')}
                style={{
                  background: 'none', border: 'none', padding: '0.5rem 0',
                  fontWeight: activeTab === 'Audit' ? '600' : '400',
                  borderBottom: activeTab === 'Audit' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer', color: activeTab === 'Audit' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={16} /> Audit History</div>
              </button>
            </div>

            {activeTab === 'Payments' && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: 'var(--color-text)' }}>Payment History</h3>
                  {(!isVoided && remainingAmount > 0) && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (onRecordPaymentClick) onRecordPaymentClick(ledgerEntry);
                      }}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Record Payment
                    </button>
                  )}
                </div>

                <div style={{ paddingRight: '0' }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>
                  ) : payments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
                      No payments recorded yet.
                    </div>
                  ) : (
                    <>
                      <div className="table-wrapper" style={{ overflowX: 'auto', marginBottom: '1.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>DATE</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>AMOUNT</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>METHOD</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>REFERENCE</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>PROOF</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map(payment => {
                              const dateObj = new Date(payment.payment_date);
                              const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                              const isPaymentVoided = payment.status === 'VOIDED';
                              
                              return (
                                <tr 
                                  key={payment.id} 
                                  onClick={(e) => {
                                    // Ignore clicks on buttons/icons to avoid double actions
                                    if (e.target.closest('button')) return;
                                    setSelectedPayment(payment);
                                  }}
                                  style={{ 
                                    borderBottom: '1px solid var(--color-border)', 
                                    opacity: isPaymentVoided ? 0.7 : 1, 
                                    backgroundColor: 'var(--color-surface)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                                >
                                  <td style={{ padding: '1rem', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <span>{dateStr}</span>
                                      {isPaymentVoided && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', width: 'fit-content' }}>VOIDED</span>}
                                    </div>
                                  </td>
                                  <td style={{ padding: '1rem', fontWeight: '600', color: isPaymentVoided ? 'var(--color-text-muted)' : 'var(--color-text)', textDecoration: isPaymentVoided ? 'line-through' : 'none' }}>
                                    ₹{parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '1rem', color: 'var(--color-text)' }}>
                                    {payment.payment_method.replace('_', ' ')}
                                  </td>
                                  <td style={{ padding: '1rem', color: 'var(--color-text-muted)', wordBreak: 'break-word', minWidth: '150px' }}>
                                    {payment.reference || payment.notes || '—'}
                                  </td>
                                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                    {payment.proof_document ? (
                                      <button 
                                        onClick={() => setPreviewProof(payment.proof_document)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500', padding: 0 }}
                                      >
                                        <ImageIcon size={14} /> View Proof
                                      </button>
                                    ) : (
                                      <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    {!isVoided && !isPaymentVoided && (
                                      <button 
                                        className="btn-icon" 
                                        style={{ color: 'var(--color-danger)', padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                                        title="Void Payment"
                                        onClick={() => setConfirmModal({
                                          isOpen: true,
                                          type: 'PAYMENT',
                                          id: payment.id,
                                          message: 'Cancelled payments will no longer be included in financial totals, but the record will remain in your history. Are you sure you want to cancel this payment?'
                                        })}
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Paid</span>
                          <span style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--color-text)' }}>₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Remaining</span>
                          <span style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '1.1rem', color: remainingAmount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {activeTab === 'Audit' && (
              <div style={{ paddingRight: '0' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>
                ) : auditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem' }}>
                    No audit history found.
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderLeft: '2px solid var(--color-border)', marginLeft: '1rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {auditLogs.map(log => {
                      const dateObj = new Date(log.timestamp);
                      const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                      const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      
                      return (
                        <div key={log.id} style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '-1.85rem', top: '0.25rem', backgroundColor: 'var(--color-bg)', padding: '0.1rem', borderRadius: '50%' }}>
                            <Clock size={16} color="var(--color-primary)" />
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                            {dateStr}, {timeStr}
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                            {log.action}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                            by {log.user_name}
                            {log.details?.amount && ` • ₹${parseFloat(log.details.amount).toLocaleString('en-IN')}`}
                            {log.details?.method && ` • ${log.details.method}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 'min(400px, calc(100vw - 32px))' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
                <AlertTriangle size={20} />
                Confirm Cancellation
              </h2>
              <button className="btn-icon" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} disabled={actionLoading}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>{confirmModal.message}</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} disabled={actionLoading}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleVoid} disabled={actionLoading}>
                  {actionLoading ? 'Voiding...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proof Preview Modal */}
      {previewProof && (
        <div className="modal-backdrop" style={{ zIndex: 1200, backgroundColor: 'rgba(0, 0, 0, 0.85)' }}>
          <div className="modal" style={{ maxWidth: 'min(800px, calc(100vw - 32px))', display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', boxShadow: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
              <a 
                href={previewProof} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <ExternalLink size={16} /> Open
              </a>
              <a 
                href={previewProof} 
                download
                className="btn btn-primary"
              >
                <Download size={16} /> Download
              </a>
              <button 
                className="btn-icon" 
                onClick={() => setPreviewProof(null)}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
              {previewProof.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={previewProof} 
                  title="Payment Proof" 
                  style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '0.5rem' }}
                />
              ) : (
                <img 
                  src={previewProof} 
                  alt="Payment Proof" 
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '0.5rem' }} 
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="modal-backdrop" style={{ zIndex: 1150 }}>
          <div className="modal" style={{ maxWidth: 'min(400px, calc(100vw - 32px))', width: '100%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Payment Details</h2>
              <button className="btn-icon" onClick={() => setSelectedPayment(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                <div style={{ color: 'var(--color-text-muted)' }}>Amount</div>
                <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>₹{parseFloat(selectedPayment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                
                <div style={{ color: 'var(--color-text-muted)' }}>Payment Date</div>
                <div style={{ color: 'var(--color-text)' }}>{new Date(selectedPayment.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                
                <div style={{ color: 'var(--color-text-muted)' }}>Payment Method</div>
                <div style={{ color: 'var(--color-text)' }}>{selectedPayment.payment_method.replace('_', ' ')}</div>
                
                <div style={{ color: 'var(--color-text-muted)' }}>Reference</div>
                <div style={{ color: 'var(--color-text)' }}>{selectedPayment.reference || '—'}</div>
                
                <div style={{ color: 'var(--color-text-muted)' }}>Notes</div>
                <div style={{ color: 'var(--color-text)' }}>{selectedPayment.notes || '—'}</div>
                
                <div style={{ color: 'var(--color-text-muted)' }}>Payment Proof</div>
                <div style={{ color: 'var(--color-text)' }}>
                  {selectedPayment.proof_document ? (
                    <button 
                      onClick={() => setPreviewProof(selectedPayment.proof_document)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', padding: 0 }}
                    >
                      <ImageIcon size={16} /> View Proof
                    </button>
                  ) : (
                    'Not uploaded'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
