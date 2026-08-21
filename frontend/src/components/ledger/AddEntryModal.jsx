import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { getCustomers } from '../../api/customers';
import { ledgerApi } from '../../api/ledger';

export default function AddEntryModal({ isOpen, onClose, onSuccess }) {
  const [type, setType] = useState('RECEIVABLE');
  
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Form fields
  const [customerId, setCustomerId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && type === 'RECEIVABLE' && customers.length === 0) {
      fetchCustomers();
    }
  }, [isOpen, type]);

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await getCustomers({ is_active: true });
      if (res.results) {
        setCustomers(res.results);
      }
    } catch (err) {
      console.error("Failed to load customers", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  if (!isOpen) return null;

  const resetForm = () => {
    setType('RECEIVABLE');
    setCustomerId('');
    setPartyName('');
    setAmount('');
    setReference('');
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
    
    if (type === 'RECEIVABLE' && !customerId && !partyName) {
      setError("Please select a customer or enter a party name.");
      return;
    }
    
    if (type === 'PAYABLE' && !partyName) {
      setError("Please enter the party name.");
      return;
    }
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        transaction_type: type,
        amount: parseFloat(amount).toFixed(2),
        reference: reference,
        notes: notes,
      };
      
      if (type === 'RECEIVABLE' && customerId) {
        payload.customer = customerId;
      } else {
        payload.party_name = partyName;
      }

      await ledgerApi.createLedgerEntry(payload);
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to save entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="modal-header">
          <h2 className="modal-title">Add Entry</h2>
          <button className="btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form id="add-entry-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="type" 
                    checked={type === 'RECEIVABLE'} 
                    onChange={() => { setType('RECEIVABLE'); setPartyName(''); }}
                  />
                  Money to Receive
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="type" 
                    checked={type === 'PAYABLE'} 
                    onChange={() => { setType('PAYABLE'); setCustomerId(''); }}
                  />
                  Money to Pay
                </label>
              </div>
            </div>

            {type === 'RECEIVABLE' ? (
              <div className="form-group">
                <label className="form-label" htmlFor="customer">Party / Customer</label>
                <select 
                  id="customer"
                  className="form-control" 
                  value={customerId} 
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    if (e.target.value) setPartyName('');
                  }}
                  disabled={loadingCustomers}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.gst_trade_name ? `(${c.gst_trade_name})` : ''}</option>
                  ))}
                </select>
                <div style={{ textAlign: 'center', margin: '0.5rem 0', color: 'var(--color-text-muted)' }}>OR</div>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter Party Name (if not a saved customer)" 
                  value={partyName} 
                  onChange={(e) => {
                    setPartyName(e.target.value);
                    if (e.target.value) setCustomerId('');
                  }}
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label" htmlFor="party_name">Party</label>
                <input 
                  id="party_name"
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. ABC Coal Suppliers" 
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="amount">Amount (₹)</label>
              <input 
                id="amount"
                type="number" 
                step="0.01"
                min="0.01"
                className="form-control" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reference">Reference / Reason</label>
              <input 
                id="reference"
                type="text" 
                className="form-control" 
                placeholder="e.g. Invoice INV0011" 
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="notes">Notes</label>
              <textarea 
                id="notes"
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
          <button type="submit" form="add-entry-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
