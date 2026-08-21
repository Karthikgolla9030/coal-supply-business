import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { ledgerApi } from '../../api/ledger';

export default function RecordPaymentModal({ isOpen, onClose, ledgerEntry, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

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
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
      
      const payload = {
        ledger_entry: ledgerEntry.id,
        amount: paymentAmt.toFixed(2),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: notes,
      };

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
      <div className="modal" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="modal-header">
          <h2 className="modal-title">Record Payment</h2>
          <button className="btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Remaining Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--color-text)' }}>₹{remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
