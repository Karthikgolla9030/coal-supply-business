import React, { useState } from 'react';
import { X, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { getCustomers } from '../../api/customers';
import { ledgerApi } from '../../api/ledger';
import { getSales } from '../../api/sales';
import CustomerSelector from '../invoice/CustomerSelector';

export default function AddEntryModal({ isOpen, onClose, onSuccess }) {
  const [type, setType] = useState('RECEIVABLE');
  
  // Selected Party object
  const [selectedParty, setSelectedParty] = useState(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  
  const [saleOrderNo, setSaleOrderNo] = useState('');
  const [purchaseOrderNo, setPurchaseOrderNo] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [tons, setTons] = useState('');
  const [ratePerTon, setRatePerTon] = useState('');
  const [tcsRate, setTcsRate] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);



  if (!isOpen) return null;

  const resetForm = () => {
    setType('RECEIVABLE');
    setSelectedParty(null);
    setAmount('');
    setReference('');
    setNotes('');
    setSaleOrderNo('');
    setPurchaseOrderNo('');
    setSerialNo('');
    setTruckNo('');
    setEntryDate('');
    setTons('');
    setRatePerTon('');
    setTcsRate('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const baseAmount = type === 'RECEIVABLE' && tons && ratePerTon
    ? (parseFloat(tons) * parseFloat(ratePerTon))
    : 0;
  const tcsAmount = type === 'RECEIVABLE' && baseAmount && tcsRate 
    ? (baseAmount * (parseFloat(tcsRate) / 100))
    : 0;
  const calculatedAmount = baseAmount ? (baseAmount + tcsAmount).toFixed(2) : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedParty) {
      setError("Please select or create a party.");
      return;
    }
    
    let finalAmount = amount;
    
    if (type === 'RECEIVABLE') {
      if (!calculatedAmount || isNaN(calculatedAmount) || parseFloat(calculatedAmount) <= 0) {
        setError("Please enter a valid quantity and rate to calculate the amount.");
        return;
      }
      finalAmount = calculatedAmount;
    } else {
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        setError("Please enter a valid amount greater than 0.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        transaction_type: type,
        amount: finalAmount,
        reference: reference,
        notes: notes,
      };
      
      if (type === 'RECEIVABLE' && saleOrderNo) payload.sale_order_no = saleOrderNo;
      if (type === 'PAYABLE' && purchaseOrderNo) payload.purchase_order_no = purchaseOrderNo;
      if (serialNo) payload.serial_no = serialNo;
      if (truckNo) payload.truck_no = truckNo;
      if (entryDate) payload.entry_date = entryDate;
      if (tons) payload.tons = parseFloat(tons).toFixed(3);
      if (tcsRate) {
        payload.tcs_rate = parseFloat(tcsRate).toFixed(2);
        payload.tcs_amount = tcsAmount.toFixed(2);
      }
      
      if (selectedParty) {
        payload.customer = selectedParty.id;
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
      <div className="modal" style={{ maxWidth: 'min(600px, calc(100vw - 32px))' }}>
        <div className="modal-header" style={{ padding: '1.5rem', paddingBottom: '1rem', borderBottom: 'none' }}>
          <div>
            <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.25rem' }}>Add Entry</h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Record a new money-to-receive or money-to-pay entry.</div>
          </div>
          <button className="btn-icon" onClick={handleClose} style={{ alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form id="add-entry-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Section 1: Transaction Type */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div 
                  onClick={() => { setType('RECEIVABLE'); }}
                  style={{
                    padding: '1rem',
                    border: type === 'RECEIVABLE' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    backgroundColor: type === 'RECEIVABLE' ? 'var(--color-primary-transparent)' : 'var(--color-surface)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ color: type === 'RECEIVABLE' ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--color-text)', marginBottom: '0.25rem' }}>Money to Receive</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>Record money customers owe you</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: type === 'RECEIVABLE' ? '5px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: type === 'RECEIVABLE' ? 'var(--color-surface)' : 'transparent' }}></div>
                  </div>
                </div>

                <div 
                  onClick={() => { setType('PAYABLE'); setSelectedParty(null); }}
                  style={{
                    padding: '1rem',
                    border: type === 'PAYABLE' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    backgroundColor: type === 'PAYABLE' ? 'var(--color-primary-transparent)' : 'var(--color-surface)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ color: type === 'PAYABLE' ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                    <ArrowUpRight size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--color-text)', marginBottom: '0.25rem' }}>Money to Pay</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>Record money you owe suppliers or other parties</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: type === 'PAYABLE' ? '5px solid var(--color-primary)' : '1px solid var(--color-border)', backgroundColor: type === 'PAYABLE' ? 'var(--color-surface)' : 'transparent' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {type === 'RECEIVABLE' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0.5rem' }}>

                {/* TO RECEIVE DETAILS */}
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', fontWeight: 600 }}>To Receive Details</h3>
                  <CustomerSelector
                    selected={selectedParty}
                    onSelect={(p) => setSelectedParty(p)}
                    partyType={['CUSTOMER', 'OTHER']}
                    label={'CUSTOMER'}
                    helperText={'Select the customer who needs to pay you.'}
                  />
                </div>

                {/* ORDER DETAILS */}
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', fontWeight: 600 }}>Order Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="saleOrderNo" style={{ display: 'block', marginBottom: '0.25rem' }}>Sale Order No.</label>
                      <input 
                        id="saleOrderNo"
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. SO-1001" 
                        value={saleOrderNo}
                        onChange={(e) => setSaleOrderNo(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="serialNo" style={{ display: 'block', marginBottom: '0.25rem' }}>Serial No.</label>
                      <input 
                        id="serialNo"
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. SN-001" 
                        value={serialNo}
                        onChange={(e) => setSerialNo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* DELIVERY DETAILS */}
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', fontWeight: 600 }}>Delivery Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="truckNo" style={{ display: 'block', marginBottom: '0.25rem' }}>Truck No.</label>
                      <input 
                        id="truckNo"
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. AP 40 XY 1234" 
                        value={truckNo}
                        onChange={(e) => setTruckNo(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="tons" style={{ display: 'block', marginBottom: '0.25rem' }}>Coal Quantity (Tons) <span className="required">*</span></label>
                      <input 
                        id="tons"
                        type="number" 
                        step="0.001"
                        min="0.001"
                        className="form-input" 
                        placeholder="Enter quantity in tons" 
                        value={tons}
                        onChange={(e) => setTons(e.target.value)}
                        onWheel={(e) => e.target.blur()}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* PRICING */}
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', fontWeight: 600 }}>Pricing</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="ratePerTon" style={{ display: 'block', marginBottom: '0.25rem' }}>Rate per Ton <span className="required">*</span></label>
                      <input 
                        id="ratePerTon"
                        type="number" 
                        step="0.01"
                        min="0.01"
                        className="form-input" 
                        placeholder="Enter rate per ton" 
                        value={ratePerTon}
                        onChange={(e) => setRatePerTon(e.target.value)}
                        onWheel={(e) => e.target.blur()}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Amount</label>
                      <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', color: calculatedAmount ? 'var(--color-text)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', opacity: 0.9 }}>
                        {calculatedAmount ? `₹${calculatedAmount}` : 'Enter quantity and rate'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="tcsRate" style={{ display: 'block', marginBottom: '0.25rem' }}>TCS Rate (%)</label>
                      <input 
                        id="tcsRate"
                        type="number" 
                        step="0.01"
                        min="0"
                        className="form-input" 
                        placeholder="Enter TCS rate" 
                        value={tcsRate}
                        onChange={(e) => setTcsRate(e.target.value)}
                        onWheel={(e) => e.target.blur()}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>TCS Amount</label>
                      <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', color: tcsAmount ? 'var(--color-text)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', opacity: 0.9 }}>
                        {tcsAmount ? `₹${tcsAmount.toFixed(2)}` : '₹0.00'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PAYMENT / BALANCE */}
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', fontWeight: 600 }}>Payment / Balance</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Total Amount</label>
                      <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', color: calculatedAmount ? 'var(--color-text)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', fontSize: '1.125rem', fontWeight: '600', padding: '0.75rem 1rem' }}>
                        {calculatedAmount ? `₹${calculatedAmount}` : '₹0.00'}
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Paid Amount</label>
                      <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', fontWeight: '600' }}>
                        ₹0.00
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Remaining Balance</label>
                      <div className="form-input" style={{ backgroundColor: 'var(--color-bg-subtle)', color: calculatedAmount ? 'var(--color-danger)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', fontWeight: '600' }}>
                        {calculatedAmount ? `₹${calculatedAmount}` : '₹0.00'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ADDITIONAL INFORMATION */}
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', fontWeight: 600 }}>Additional Information</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="reference" style={{ display: 'block', marginBottom: '0.25rem' }}>Reference / Reason</label>
                      <input 
                        id="reference"
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Coal sale / customer order" 
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="entryDate" style={{ display: 'block', marginBottom: '0.25rem' }}>Date</label>
                      <input 
                        id="entryDate"
                        type="date" 
                        className="form-input" 
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
                    <label className="form-label" htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem' }}>Notes <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(Optional)</span></label>
                    <textarea 
                      id="notes"
                      className="form-textarea" 
                      placeholder="Add any additional notes..." 
                      rows="3"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <CustomerSelector
                  selected={selectedParty}
                  onSelect={(p) => setSelectedParty(p)}
                  partyType={['SUPPLIER', 'TRANSPORTER', 'OTHER']}
                  label={'PARTY'}
                  helperText={'Select the supplier, transporter, or other party you need to pay.'}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="amount" style={{ display: 'block', marginBottom: '0.5rem' }}>Amount (₹) <span className="required">*</span></label>
                    <input 
                      id="amount"
                      type="number" 
                      step="0.01"
                      min="0.01"
                      className="form-input" 
                      placeholder="Enter amount" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="purchaseOrderNo" style={{ display: 'block', marginBottom: '0.25rem' }}>Purchase Order No.</label>
                    <input 
                      id="purchaseOrderNo"
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. PO-1001" 
                      value={purchaseOrderNo}
                      onChange={(e) => setPurchaseOrderNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="serialNo" style={{ display: 'block', marginBottom: '0.25rem' }}>Serial No.</label>
                    <input 
                      id="serialNo"
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. SN-001" 
                      value={serialNo}
                      onChange={(e) => setSerialNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="truckNo" style={{ display: 'block', marginBottom: '0.25rem' }}>Truck No.</label>
                    <input 
                      id="truckNo"
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. AP 40 XY 1234" 
                      value={truckNo}
                      onChange={(e) => setTruckNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="entryDate" style={{ display: 'block', marginBottom: '0.25rem' }}>Date</label>
                    <input 
                      id="entryDate"
                      type="date" 
                      className="form-input" 
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="tons" style={{ display: 'block', marginBottom: '0.25rem' }}>Tons</label>
                    <input 
                      id="tons"
                      type="number" 
                      step="0.001"
                      min="0.001"
                      className="form-input" 
                      placeholder="Enter quantity in tons" 
                      value={tons}
                      onChange={(e) => setTons(e.target.value)}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="reference" style={{ display: 'block', marginBottom: '0.25rem' }}>Reference / Reason</label>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Invoice number, bill number, or reason.</div>
                    <input 
                      id="reference"
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Coal Purchase" 
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem' }}>Notes <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(Optional)</span></label>
                  <textarea 
                    id="notes"
                    className="form-textarea" 
                    placeholder="Add any additional notes..." 
                    rows="3"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  ></textarea>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
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
