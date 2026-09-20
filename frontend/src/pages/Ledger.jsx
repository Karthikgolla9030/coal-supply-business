import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, ChevronRight, AlertCircle, RefreshCw, LayoutDashboard, List, ArrowDownLeft, ArrowUpRight, CheckCircle, FileText } from 'lucide-react';
import { ledgerApi } from '../api/ledger';

import PageHeader from '../components/layout/PageHeader';
import AddEntryModal from '../components/ledger/AddEntryModal';
import RecordPaymentModal from '../components/ledger/RecordPaymentModal';
import EntryDetailsModal from '../components/ledger/EntryDetailsModal';
import LedgerDashboard from '../components/ledger/LedgerDashboard';
import TransactionHistoryList from '../components/ledger/TransactionHistoryList';
import ReportsDashboard from '../components/ledger/ReportsDashboard';

const tabsConfig = [
  { id: 'Overview', icon: LayoutDashboard, label: 'Overview', desc: 'Financial summary and recent activity.' },
  { id: 'Transactions', icon: List, label: 'Transactions', desc: 'View all money received, money paid, invoices, and financial entries.' },
  { id: 'To Receive', icon: ArrowDownLeft, label: 'To Receive', desc: 'Money customers still need to pay you.' },
  { id: 'To Pay', icon: ArrowUpRight, label: 'To Pay', desc: 'Money you still need to pay suppliers, transporters, or other parties.' },
  { id: 'Paid', icon: CheckCircle, label: 'Paid', desc: 'Payments that have already been completed.' },
  { id: 'Reports', icon: FileText, label: 'Reports', desc: 'View and export financial reports.' }
];

export default function Ledger() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEntryDetails, setSelectedEntryDetails] = useState(null);
  const [paymentEntry, setPaymentEntry] = useState(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ledgerApi.getLedgerEntries();
      const data = res.data || {};
      if (data.results) {
        setEntries(data.results);
      } else if (Array.isArray(data)) {
        setEntries(data);
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

  // Filter entries for display
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // 1. Tab Filtering
      let tabMatch = true;
      if (activeTab === 'To Receive') tabMatch = entry.transaction_type === 'RECEIVABLE' && entry.status !== 'PAID' && entry.status !== 'VOIDED';
      else if (activeTab === 'To Pay') tabMatch = entry.transaction_type === 'PAYABLE' && entry.status !== 'PAID' && entry.status !== 'VOIDED';
      else if (activeTab === 'Paid') tabMatch = entry.status === 'PAID';

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

  const handlePaymentSuccess = async () => {
    setPaymentEntry(null);
    try {
      setLoading(true);
      const res = await ledgerApi.getLedgerEntries();
      const data = res.data || {};
      const newEntries = data.results || (Array.isArray(data) ? data : []);
      setEntries(newEntries);
      
      if (selectedEntryDetails) {
        const updatedEntry = newEntries.find(e => e.id === selectedEntryDetails.id);
        if (updatedEntry) {
          setSelectedEntryDetails(updatedEntry);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'PAID': return 'badge-paid';
      case 'PARTIALLY_PAID': return 'badge-partial';
      case 'VOIDED': return 'badge-voided';
      default: return 'badge-pending';
    }
  };

  const statusDisplay = {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY PAID',
    PAID: 'PAID',
    VOIDED: 'VOIDED'
  };

  const activeTabConfig = tabsConfig.find(t => t.id === activeTab);

  return (
    <div className="page-content page-content-wide">
      <PageHeader 
        title="Money & Ledger"
        description="Manage money to receive, money to pay, and your payment history."
        action={
          <button 
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ padding: '0.5rem 1rem' }}
          >
            <Plus size={18} /> Add Entry
          </button>
        }
      />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchEntries} style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem' }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'inline-flex', 
          background: 'var(--color-surface)', 
          padding: '0.25rem', 
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border)',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          {tabsConfig.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  backgroundColor: isActive ? 'var(--color-surface-2)' : 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                  border: isActive ? '1px solid var(--color-border-light)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'Overview' ? (
        <LedgerDashboard />
      ) : activeTab === 'Transactions' ? (
        <TransactionHistoryList />
      ) : activeTab === 'Reports' ? (
        <ReportsDashboard />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                {activeTab}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {activeTabConfig?.desc}
              </p>
            </div>
            
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
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

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Loading ledger entries...
              </div>
            ) : filteredEntries.length === 0 ? (
              <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  {searchQuery ? "No entries found matching your search." : 
                  activeTab === 'To Receive' ? "No customers still need to pay." : 
                  activeTab === 'To Pay' ? "No money still to pay." : 
                  activeTab === 'Paid' ? "No completed payments yet." :
                  "No ledger entries found."}
                </div>
                {!searchQuery && (
                  <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(true)}>
                    <Plus size={16} /> Add Entry
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    {activeTab === 'Paid' ? (
                      <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>DATE</th>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>RECEIVED / PAID</th>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>CUSTOMER / PARTY</th>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>REFERENCE</th>
                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>AMOUNT</th>
                      </tr>
                    ) : (
                      <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>
                          {activeTab === 'To Receive' ? 'CUSTOMER' : 'SUPPLIER / TRANSPORTER / PAYEE'}
                        </th>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>REFERENCE</th>
                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>TOTAL AMOUNT</th>
                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>PAID</th>
                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontWeight: '600', color: 'var(--color-text)' }}>
                          {activeTab === 'To Receive' ? 'STILL TO RECEIVE' : 'STILL TO PAY'}
                        </th>
                        <th style={{ textAlign: 'center', padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>STATUS</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {filteredEntries.map(entry => {
                      const origAmt = parseFloat(entry.amount);
                      const paidAmt = parseFloat(entry.paid_amount || entry.amount - entry.remaining_amount || 0);
                      const remAmt = parseFloat(entry.remaining_amount || origAmt - paidAmt);
                      const partyName = entry.party_name || entry.customer_name || "Unknown Party";
                      
                      if (activeTab === 'Paid') {
                        return (
                          <tr 
                            key={entry.id} 
                            style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                            onClick={() => setSelectedEntryDetails(entry)}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text)' }}>
                              {entry.date || entry.created_at?.split('T')[0] || '—'}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text)' }}>
                              {entry.transaction_type === 'RECEIVABLE' ? 'Received' : 'Paid'}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text)' }}>
                              {partyName}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-muted)' }}>
                              {entry.reference || '—'}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '600', color: 'var(--color-text)' }}>
                              ₹{origAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr 
                          key={entry.id} 
                          style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                          onClick={() => setSelectedEntryDetails(entry)}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text)' }}>
                            {partyName}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-muted)' }}>
                            {entry.reference || '—'}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--color-text)' }}>
                            ₹{origAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            ₹{paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '600', color: remAmt > 0 ? (entry.transaction_type === 'RECEIVABLE' ? 'var(--color-primary-light)' : 'var(--color-warning)') : 'var(--color-text)' }}>
                            ₹{remAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                            <span className={`badge ${getStatusBadgeClass(entry.status)}`}>
                              {statusDisplay[entry.status] || entry.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals remain exactly the same */}
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
