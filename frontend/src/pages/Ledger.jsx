import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { ledgerApi } from '../api/ledger';

import AddEntryModal from '../components/ledger/AddEntryModal';
import RecordPaymentModal from '../components/ledger/RecordPaymentModal';
import EntryDetailsModal from '../components/ledger/EntryDetailsModal';

export default function Ledger() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, TO RECEIVE, TO PAY, PENDING, PARTIALLY PAID, PAID
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEntryDetails, setSelectedEntryDetails] = useState(null);
  const [paymentEntry, setPaymentEntry] = useState(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all to do client side filtering and accurate sum for the dashboard.
      // In a very large app we would paginate and ask backend for aggregate sums.
      // Since requirements ask for dynamic calculation and filtering, we'll fetch all matching entries.
      const res = await ledgerApi.getLedgerEntries();
      if (res.results) {
        setEntries(res.results);
      }
    } catch (err) {
      setError(err.message || "Failed to load ledger entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Calculate summaries based on ALL data
  const summary = useMemo(() => {
    let toReceive = 0;
    let toPay = 0;
    let received = 0;
    let paid = 0;

    entries.forEach(entry => {
      const origAmt = parseFloat(entry.amount);
      const paidAmt = parseFloat(entry.paid_amount || entry.amount - entry.remaining_amount || 0); // fallback
      const remAmt = parseFloat(entry.remaining_amount || origAmt - paidAmt);

      if (entry.transaction_type === 'RECEIVABLE') {
        received += paidAmt;
        if (entry.status !== 'PAID') {
          toReceive += remAmt;
        }
      } else if (entry.transaction_type === 'PAYABLE') {
        paid += paidAmt;
        if (entry.status !== 'PAID') {
          toPay += remAmt;
        }
      }
    });

    return { toReceive, toPay, received, paid };
  }, [entries]);

  // Filter entries for display
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // 1. Tab Filtering
      let tabMatch = true;
      if (activeTab === 'TO RECEIVE') tabMatch = entry.transaction_type === 'RECEIVABLE';
      else if (activeTab === 'TO PAY') tabMatch = entry.transaction_type === 'PAYABLE';
      else if (activeTab === 'PENDING') tabMatch = entry.status === 'PENDING';
      else if (activeTab === 'PARTIALLY PAID') tabMatch = entry.status === 'PARTIALLY_PAID';
      else if (activeTab === 'PAID') tabMatch = entry.status === 'PAID';

      // 2. Search Filtering
      let searchMatch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const partyName = (entry.party_name || entry.customer_name || '').toLowerCase();
        const ref = (entry.reference || '').toLowerCase();
        searchMatch = partyName.includes(q) || ref.includes(q);
      }

      return tabMatch && searchMatch;
    });
  }, [entries, activeTab, searchQuery]);

  const handleAddSuccess = () => {
    fetchEntries();
  };

  const handlePaymentSuccess = () => {
    // If details modal is open, we need to refresh it.
    // Easiest is to close it and refresh list, or refresh list and update selected entry.
    setSelectedEntryDetails(null); 
    fetchEntries();
  };
  
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Money & Ledger</h1>
          <p className="page-subtitle">Track money to receive, money to pay, and payment history.</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={18} /> Add Entry
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchEntries} style={{ marginLeft: 'auto' }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>To Receive</div>
          <div style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--color-text)' }}>₹{summary.toReceive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>To Pay</div>
          <div style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--color-text)' }}>₹{summary.toPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Received</div>
          <div style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--color-success)' }}>₹{summary.received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Paid</div>
          <div style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--color-danger)' }}>₹{summary.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['ALL', 'TO RECEIVE', 'TO PAY', 'PENDING', 'PARTIALLY PAID', 'PAID'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: '500',
                backgroundColor: activeTab === tab ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                color: activeTab === tab ? 'white' : 'var(--color-text)',
                border: activeTab === tab ? 'none' : '1px solid var(--color-border)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search party or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {/* Data List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading ledger entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
              {searchQuery ? "No entries found matching your search." : 
               activeTab === 'TO RECEIVE' ? "No money to receive yet." : 
               activeTab === 'TO PAY' ? "No money to pay yet." : 
               activeTab === 'PAID' ? "No completed payments yet." :
               "No ledger entries found."}
            </div>
            {!searchQuery && (
              <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={18} /> Add Entry
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>PARTY</th>
                  <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>TYPE</th>
                  <th style={{ textAlign: 'right', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>AMOUNT</th>
                  <th style={{ textAlign: 'right', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>REMAINING</th>
                  <th style={{ textAlign: 'center', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>STATUS</th>
                  <th style={{ width: '40px', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => {
                  const origAmt = parseFloat(entry.amount);
                  const paidAmt = parseFloat(entry.paid_amount || entry.amount - entry.remaining_amount || 0);
                  const remAmt = parseFloat(entry.remaining_amount || origAmt - paidAmt);
                  
                  return (
                    <tr 
                      key={entry.id} 
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                      onClick={() => setSelectedEntryDetails(entry)}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '500' }}>{entry.party_name || entry.customer_name || "Unknown Party"}</div>
                        {entry.reference && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{entry.reference}</div>}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {entry.transaction_type === 'RECEIVABLE' ? 'Receive' : 'Pay'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '500' }}>
                        ₹{origAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '500', color: remAmt > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                        ₹{remAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: (statusColors[entry.status] || statusColors.PENDING).bg,
                          color: (statusColors[entry.status] || statusColors.PENDING).text
                        }}>
                          {statusDisplay[entry.status] || entry.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        <ChevronRight size={18} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddEntryModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={handleAddSuccess} 
      />
      
      <EntryDetailsModal 
        isOpen={!!selectedEntryDetails} 
        onClose={() => setSelectedEntryDetails(null)} 
        ledgerEntry={selectedEntryDetails}
        onRecordPaymentClick={(entry) => setPaymentEntry(entry)}
      />

      <RecordPaymentModal 
        isOpen={!!paymentEntry} 
        onClose={() => setPaymentEntry(null)} 
        ledgerEntry={paymentEntry}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
