import React, { useState, useRef } from 'react';
import { X, AlertCircle, UploadCloud, File as FileIcon, FileImage, Trash2 } from 'lucide-react';
import { ledgerApi } from '../../api/ledger';

export default function RecordPaymentModal({ isOpen, onClose, ledgerEntry, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);

  if (!isOpen || !ledgerEntry) return null;

  // Remaining balance
  const originalAmount = parseFloat(ledgerEntry.amount);
  const paidAmount = parseFloat(ledgerEntry.paid_amount || ledgerEntry.amount - ledgerEntry.remaining_amount || 0); // fallback calculation
  const remaining = parseFloat(ledgerEntry.remaining_amount || originalAmount - paidAmount);

  const resetForm = () => {
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('CASH');
    setNotes('');
    setProofFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setError(null);
    
    if (file) {
      // 5MB limit
      if (file.size > 5 * 1024 * 1024) {
        setError('File is too large. Please upload a file smaller than 5MB.');
        e.target.value = '';
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Unsupported file type. Please upload a JPG, PNG, WEBP, or PDF file.');
        e.target.value = '';
        return;
      }
      
      setProofFile(file);
    }
  };

  const handleRemoveFile = () => {
    setProofFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    const paymentAmt = parseFloat(amount);
    
    if (!paymentAmt || isNaN(paymentAmt) || paymentAmt <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    
    // Explicit frontend validation for overpayment
    if (paymentAmt > remaining) {
      setError("Payment cannot be greater than the remaining amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      let payload;
      if (proofFile) {
        payload = new FormData();
        payload.append('ledger_entry', ledgerEntry.id);
        payload.append('amount', paymentAmt.toFixed(2));
        payload.append('payment_date', paymentDate);
        payload.append('payment_method', paymentMethod);
        payload.append('notes', notes);
        payload.append('proof_document', proofFile);
      } else {
        payload = {
          ledger_entry: ledgerEntry.id,
          amount: paymentAmt.toFixed(2),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          notes: notes,
        };
      }

      await ledgerApi.createLedgerPayment(payload);
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 'min(400px, calc(100vw - 32px))', width: '100%' }}>
        <div className="modal-header">
          <h2 className="modal-title">Record Payment</h2>
          <button className="btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-surface-2)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Remaining Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', marginTop: '0.25rem' }}>₹{remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form id="record-payment-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="payment-amount">Amount (₹)</label>
              <input 
                id="payment-amount"
                type="number" 
                step="0.01"
                min="0.01"
                max={remaining}
                className="form-control" 
                placeholder="Enter payment amount" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onWheel={(e) => e.target.blur()}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="payment-date">Payment Date</label>
              <input 
                id="payment-date"
                type="date" 
                className="form-control" 
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="payment-method">Payment Method</label>
              <select 
                id="payment-method"
                className="form-control" 
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Payment Proof (Optional)</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Upload screenshot, receipt, cheque image, bank slip, or other proof.
              </p>
              
              {!proofFile ? (
                <div 
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  style={{ 
                    border: '1px dashed var(--color-border)', 
                    borderRadius: '0.375rem', 
                    padding: '1.5rem 1rem', 
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-bg-subtle)',
                    transition: 'border-color 0.2s, background-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                  }}
                >
                  <UploadCloud size={24} style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>Upload payment proof</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>JPG, PNG, WEBP, or PDF (Max 5MB)</div>
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.375rem',
                  backgroundColor: 'var(--color-surface-2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--color-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {proofFile.type === 'application/pdf' ? <FileIcon size={20} color="var(--color-primary)" /> : <FileImage size={20} color="var(--color-success)" />}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {proofFile.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleRemoveFile}
                    className="btn-icon" 
                    style={{ color: 'var(--color-danger)' }}
                    title="Remove file"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }} 
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="payment-notes">Notes</label>
              <textarea 
                id="payment-notes"
                className="form-control" 
                placeholder="Optional notes" 
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" form="record-payment-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
