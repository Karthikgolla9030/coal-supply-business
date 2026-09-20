import React, { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, Filter, Eye, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { ledgerApi } from '../../api/ledger';
import * as customersApi from '../../api/customers';
import { Link } from 'react-router-dom';
import EntryDetailsModal from './EntryDetailsModal'; // Assuming we can adapt or use this for details

export default function TransactionHistoryList() {
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    type_filter: 'All',
    status_filter: '',
    payment_method: '',
    party_id: '',
    dateFilter: 'ALL_TIME',
    customStart: '',
    customEnd: ''
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Details Modal
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Load Customers for filter
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await customersApi.getCustomers();
        const data = res.data || {};
        setCustomers(data.results || data || []);
      } catch (err) {
        console.error("Failed to fetch customers", err);
      }
    };
    fetchCustomers();
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiFilters = {
        search: filters.search,
        party_id: filters.party_id,
        status_filter: filters.status_filter,
        payment_method: filters.payment_method
      };

      if (filters.type_filter !== 'All') {
        apiFilters.type_filter = filters.type_filter;
      }

      // Date logic
      const today = new Date();
      if (filters.dateFilter === 'TODAY') {
        const dateStr = today.toISOString().split('T')[0];
        apiFilters.start_date = dateStr;
        apiFilters.end_date = dateStr;
      } else if (filters.dateFilter === 'THIS_WEEK') {
        const first = today.getDate() - today.getDay();
        const start = new Date(today.setDate(first));
        apiFilters.start_date = start.toISOString().split('T')[0];
        apiFilters.end_date = new Date().toISOString().split('T')[0];
      } else if (filters.dateFilter === 'THIS_MONTH') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        apiFilters.start_date = start.toISOString().split('T')[0];
        apiFilters.end_date = new Date().toISOString().split('T')[0];
      } else if (filters.dateFilter === 'LAST_MONTH') {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        apiFilters.start_date = start.toISOString().split('T')[0];
        apiFilters.end_date = end.toISOString().split('T')[0];
      } else if (filters.dateFilter === 'CUSTOM' && filters.customStart && filters.customEnd) {
        apiFilters.start_date = filters.customStart;
        apiFilters.end_date = filters.customEnd;
      }

      const res = await ledgerApi.getTransactionHistory(apiFilters, page);
      const data = res.data || {};
      setTransactions(data.results || []);
      setTotalRecords(data.count || 0);
      
      // Assuming 25 per page (default pagination)
      const pageSize = 25;
      setTotalPages(Math.ceil((data.count || 0) / pageSize) || 1);
      
    } catch (err) {
      setError("Failed to load transaction history.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    // Debounce search slightly
    const timeoutId = setTimeout(() => {
      fetchHistory();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchHistory]);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const statusColors = {
    PENDING: { bg: 'rgba(239, 68, 68, 0.1)', text: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' },
    PARTIALLY_PAID: { bg: 'rgba(245, 158, 11, 0.1)', text: '#fcd34d', border: '1px solid rgba(245,158,11,0.2)' },
    PAID: { bg: 'rgba(16, 185, 129, 0.1)', text: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' },
    RECORDED: { bg: 'rgba(99, 102, 241, 0.1)', text: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' },
    VOIDED: { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }
  };

  const getTransactionTypeLabel = (recordType, transactionType, reference) => {
    if (recordType === 'ENTRY') {
      if (reference && String(reference).toUpperCase().startsWith('INV')) {
        return 'Invoice Created';
      }
      return 'Ledger Entry';
    } else {
      return transactionType === 'RECEIVABLE' ? 'Payment Received' : 'Payment Made';
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // reset to page 1 on filter change
  };

  const openDetails = (txn) => {
    setSelectedTransaction(txn);
    setIsDetailsOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Unified Filter Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', marginBottom: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          
          <div style={{ position: 'relative', flex: '1 1 250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search transactions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', paddingLeft: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--color-text-muted)' }} />
            <select 
              className="form-control" 
              style={{ width: 'auto', border: 'none', backgroundColor: 'transparent' }}
              value={filters.type_filter}
              onChange={(e) => handleFilterChange('type_filter', e.target.value)}
            >
              <option value="All">All Activity</option>
              <option value="Money to Receive">Invoice / Ledger Entry</option>
              <option value="Money to Pay">Payable Ledger Entry</option>
              <option value="Money Received">Payment Received</option>
              <option value="Money Paid">Payment Made</option>
            </select>
          </div>

          <select 
            className="form-control" 
            style={{ width: 'auto', maxWidth: '200px' }}
            value={filters.party_id}
            onChange={(e) => handleFilterChange('party_id', e.target.value)}
          >
            <option value="">All Customers/Parties</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select 
            className="form-control" 
            style={{ width: 'auto' }}
            value={filters.status_filter || ''}
            onChange={(e) => handleFilterChange('status_filter', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="RECORDED">Recorded</option>
            <option value="VOIDED">Voided</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', paddingLeft: '0.5rem' }}>
            <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
            <select 
              className="form-control" 
              style={{ width: 'auto', border: 'none', backgroundColor: 'transparent' }}
              value={filters.dateFilter}
              onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
            >
              <option value="ALL_TIME">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>

          {(filters.search || filters.type_filter !== 'All' || filters.party_id || filters.status_filter || filters.dateFilter !== 'ALL_TIME') && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFilters({
                  search: '',
                  type_filter: 'All',
                  status_filter: '',
                  payment_method: '',
                  party_id: '',
                  dateFilter: 'ALL_TIME',
                  customStart: '',
                  customEnd: ''
                });
                setPage(1);
              }}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              Clear Filters
            </button>
          )}

        </div>
        
        {filters.dateFilter === 'CUSTOM' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <input type="date" className="form-control" style={{ width: 'auto' }} value={filters.customStart} onChange={e => handleFilterChange('customStart', e.target.value)} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>to</span>
            <input type="date" className="form-control" style={{ width: 'auto' }} value={filters.customEnd} onChange={e => handleFilterChange('customEnd', e.target.value)} />
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
          <button className="btn btn-sm btn-secondary" onClick={fetchHistory} style={{ marginLeft: 'auto' }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Summary above table */}
      {!loading && !error && (
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>
          Showing {transactions.length} of {totalRecords} transactions.
        </div>
      )}

      {/* Transaction Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 0 }}>
        {loading ? (
           <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading transactions...</div>
        ) : transactions.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: '500' }}>Party</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: '500' }}>Type</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: '500' }}>Reference</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: '500', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: '500', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: '500', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn, idx) => {
                const label = getTransactionTypeLabel(txn.record_type, txn.unified_transaction_type, txn.unified_reference);
                const isPositive = txn.unified_transaction_type === 'RECEIVABLE';
                const statusColor = statusColors[txn.unified_status] || { bg: '#f3f4f6', text: '#374151' };

                return (
                  <tr 
                    key={`${txn.record_type}-${txn.id}-${idx}`} 
                    style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.15s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text)' }}>{txn.unified_date}</td>
                    
                    <td style={{ padding: '1rem 1.5rem' }}>
                      {txn.unified_party_id ? (
                        <Link to={`/customers/${txn.unified_party_id}`} style={{ fontWeight: '500', color: 'var(--color-text)', textDecoration: 'none' }}>
                          {txn.unified_party_name}
                        </Link>
                      ) : (
                        <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>{txn.unified_party_name}</span>
                      )}
                    </td>
                    
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>{label}</span>
                      {txn.unified_method && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: '0.25rem' }}>Method: {txn.unified_method}</div>}
                    </td>

                    <td style={{ padding: '1rem 1.5rem' }}>
                      {txn.unified_invoice_id ? (
                         <Link to={`/invoices/${txn.unified_invoice_id}`} style={{ fontWeight: '500', color: 'var(--color-primary-light)', textDecoration: 'none' }}>
                           Invoice {txn.unified_reference}
                         </Link>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>{txn.unified_reference || '-'}</span>
                      )}
                    </td>

                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '600', color: (txn.unified_status === 'VOIDED') ? 'var(--color-text-muted)' : (isPositive ? 'var(--color-primary-light)' : 'var(--color-text)'), textDecoration: txn.unified_status === 'VOIDED' ? 'line-through' : 'none' }}>
                       {isPositive ? '+' : '-'}{formatMoney(txn.unified_amount)}
                    </td>

                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        backgroundColor: statusColor.bg,
                        color: statusColor.text,
                        border: statusColor.border || '1px solid transparent'
                      }}>
                        {txn.unified_status.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openDetails(txn)} style={{ padding: '0.25rem 0.5rem' }}>
                        <Eye size={16} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
             <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No transactions match this filter.</p>
             <p style={{ fontSize: '0.875rem' }}>Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
          <button 
            className="btn btn-secondary" 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={18} /> Previous
          </button>
          <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
          <button 
            className="btn btn-secondary" 
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Transaction Details Modal */}
      {/* We need to adapt this slightly, maybe use a custom modal for payments vs entries */}
      {isDetailsOpen && selectedTransaction && (
         // For now, if it's an ENTRY we can use EntryDetailsModal if we fetch the full entry.
         // Wait, EntryDetailsModal expects a full LedgerEntry object.
         // We might need a custom mini-modal or fetch the full entry data here.
         <TransactionDetailModal 
            isOpen={isDetailsOpen} 
            onClose={() => setIsDetailsOpen(false)} 
            transaction={selectedTransaction} 
            formatMoney={formatMoney}
            onRefresh={fetchHistory}
         />
      )}

    </div>
  );
}

function TransactionDetailModal({ isOpen, onClose, transaction, formatMoney, onRefresh }) {
  if (!isOpen || !transaction) return null;

  const isEntry = transaction.record_type === 'ENTRY';
  const label = isEntry 
    ? (transaction.unified_transaction_type === 'RECEIVABLE' ? 'Money to Receive' : 'Money to Pay')
    : (transaction.unified_transaction_type === 'RECEIVABLE' ? 'Payment Received' : 'Payment Made');

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal" style={{ maxWidth: 'min(500px, calc(100vw - 32px))' }}>
        <div className="modal-header">
          <h2 className="modal-title">Transaction Details</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Type</div>
              <div style={{ fontWeight: '500' }}>{label}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Date</div>
              <div style={{ fontWeight: '500' }}>{transaction.unified_date}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Party</div>
              <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{transaction.unified_party_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Amount</div>
              <div style={{ fontWeight: '700', fontSize: '1.25rem', color: (transaction.unified_status === 'VOIDED') ? 'var(--color-text-muted)' : 'var(--color-text)', textDecoration: transaction.unified_status === 'VOIDED' ? 'line-through' : 'none' }}>{formatMoney(transaction.unified_amount)}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '0.5rem' }}>Additional Info</div>
            {transaction.unified_reference && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Reference:</span>
                <span style={{ fontWeight: '500' }}>{transaction.unified_reference}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Status:</span>
              <span style={{ fontWeight: '500' }}>{transaction.unified_status.replace('_', ' ')}</span>
            </div>
            {!isEntry && transaction.unified_method && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Payment Method:</span>
                <span style={{ fontWeight: '500' }}>{transaction.unified_method}</span>
              </div>
            )}
          </div>
          
          {isEntry && (
             <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
               To see full payment history for this entry, navigate to the <br/>
               <strong>To Receive / To Pay</strong> tab or the Party's Ledger.
             </div>
          )}

        </div>
      </div>
    </>
  );
}
