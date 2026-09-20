import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { INDIAN_STATES, getStateCode } from '../utils/states';
import {
  getCustomer,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
  getCustomerLedgerHistory,
  getCustomerSaleSummary
} from '../api/customers';
import { getSales } from '../api/sales';
import { verifyGSTIN } from '../api/gst';
import { getInvoices, downloadInvoicePdf } from '../api/invoices';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Save, Edit2, CheckCircle, AlertCircle, Calendar, Wallet } from 'lucide-react';
import RecordPaymentModal from '../components/ledger/RecordPaymentModal';
import EntryDetailsModal from '../components/ledger/EntryDetailsModal';
import { ledgerApi } from '../api/ledger';

const EMPTY_FORM = {
  name: '',
  party_type: 'CUSTOMER',
  address: '',
  gst_registered: false,
  gstin: '',
  gst_verified: false,
  gst_status: '',
  gst_legal_name: '',
  gst_trade_name: '',
  aadhaar_no: '',
  state: '',
  state_code: '',
  phone: '',
};

function extractErrors(data) {
  if (!data || typeof data !== 'object') return {};
  const errors = {};
  for (const [key, val] of Object.entries(data)) {
    errors[key] = Array.isArray(val) ? val[0] : val;
  }
  return errors;
}

// ── Customer Invoice History ──────────────────────────────────
function CustomerInvoiceHistory({ customerId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    getInvoices({ customer: customerId, page })
      .then(res => {
        setInvoices(res.data.results);
        setCount(res.data.count);
        setError('');
      })
      .catch(err => setError('Failed to load invoices.'))
      .finally(() => setLoading(false));
  }, [customerId, page]);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
    }).format(amount);
  };

  if (loading && invoices.length === 0) return <div className="loading-state"><span className="spinner" /> Loading history...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (invoices.length === 0) return <EmptyState icon={<FileText size={48} />} title="No invoices found" message="This customer has no invoice history." />;

  return (
    <div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '0.75rem' }}>Invoice</th>
              <th style={{ padding: '0.75rem' }}>Date</th>
              <th style={{ padding: '0.75rem' }}>Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '0.75rem' }}>
                  <Link to={`/invoices/${inv.id}`} style={{ fontWeight: '500', color: 'var(--color-primary)' }}>
                    {inv.invoice_number}
                  </Link>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td style={{ padding: '0.75rem' }}>{inv.transaction_type}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatAmount(inv.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {count > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={page * pageSize >= count} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Customer Sale History ──────────────────────────────────────
function CustomerSaleHistory({ customerId }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSales({ customer: customerId })
      .then(res => setSales(res.data.results || res.data))
      .catch(() => setError('Failed to load sales history.'))
      .finally(() => setLoading(false));

    getCustomerSaleSummary(customerId)
      .then(res => setSummary(res.data))
      .catch(console.error);
  }, [customerId]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total Sales</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{summary?.total_sales || 0}</div>
        </div>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total Tons Sold</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{Number(summary?.total_tons || 0).toFixed(2)} MT</div>
        </div>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total Sale Value</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(summary?.total_sale_value)}</div>
        </div>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total Including GST</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-primary)' }}>{formatCurrency(summary?.total_including_gst)}</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state"><span className="spinner" /> Loading sales...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : sales.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="No Sales Recorded" message="This customer does not have any sales records yet." action={
          <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>Add Sale</button>
        } />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-bg-card)' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.75rem' }}>Order / Sale No.</th>
                <th style={{ padding: '0.75rem' }}>Truck No.</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Tons</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Rate</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Amount</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: s.is_active ? 1 : 0.6 }}>
                  <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                    {new Date(s.sale_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{s.sale_order_no || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{s.truck_no || '—'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>{Number(s.quantity_tons).toLocaleString()} MT</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(s.rate_per_ton)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(s.total_amount)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <StatusBadge active={s.is_active} activeText="RECORDED" inactiveText="ARCHIVED" />
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/sales/${s.id}`)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Customer Ledger History ────────────────────────────────────
function CustomerLedgerHistory({ customer, onRefresh }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactionType, setTransactionType] = useState('RECEIVABLE');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedLedgerEntry, setSelectedLedgerEntry] = useState(null);

  const loadEntries = useCallback(() => {
    setLoading(true);
    ledgerApi.getLedgerEntries({ customer: customer.id, transaction_type: transactionType })
      .then(res => {
        setEntries(res.data.results || res.data);
        setError('');
      })
      .catch(() => setError('Failed to load ledger entries.'))
      .finally(() => setLoading(false));
  }, [customer.id, transactionType]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Compute stats based on fetched entries
  const totalOrders = entries.length;
  const totalTrucks = entries.filter(e => e.truck_no).length;
  const totalTons = entries.reduce((acc, curr) => acc + (parseFloat(curr.tons) || 0), 0);
  const totalAmount = entries.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const totalReceived = entries.reduce((acc, curr) => acc + (parseFloat(curr.paid_amount) || 0), 0);
  const stillToReceive = entries.reduce((acc, curr) => acc + (parseFloat(curr.remaining_amount) || 0), 0);

  const formatAmount = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt || 0);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className={`btn ${transactionType === 'RECEIVABLE' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTransactionType('RECEIVABLE')}>
          To Receive
        </button>
        <button className={`btn ${transactionType === 'PAYABLE' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTransactionType('PAYABLE')}>
          To Pay
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total Orders / Trucks</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{totalOrders} / {totalTrucks}</div>
        </div>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total Tons</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{totalTons.toFixed(2)} MTS</div>
        </div>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total Amount</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatAmount(totalAmount)}</div>
        </div>
        <div className="card" style={{ padding: '1rem', margin: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Total {transactionType === 'RECEIVABLE' ? 'Received' : 'Paid'}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-success)' }}>{formatAmount(totalReceived)}</div>
        </div>
        <div className="card" style={{ padding: '1rem', margin: 0, border: stillToReceive > 0 ? '1px solid var(--color-danger)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Remaining</div>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: stillToReceive > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
            {formatAmount(stillToReceive)}
          </div>
        </div>
      </div>

      {/* Action Row */}
      {stillToReceive > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <button className="btn btn-primary" onClick={() => {
            const oldestUnpaid = entries.find(e => e.status !== 'PAID');
            if (oldestUnpaid) {
              setSelectedLedgerEntry(oldestUnpaid);
              setIsPaymentModalOpen(true);
            }
          }}>
            Record Payment for Oldest Unpaid
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-state"><span className="spinner" /> Loading entries...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : entries.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="No Ledger Entries" message={`This customer does not have any ${transactionType === 'RECEIVABLE' ? 'Money to Receive' : 'Money to Pay'} transactions yet.`} />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-bg-card)' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.75rem' }}>Order No.</th>
                <th style={{ padding: '0.75rem' }}>Serial No.</th>
                <th style={{ padding: '0.75rem' }}>Truck No.</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Tons</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Paid</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                    {new Date(entry.entry_date || entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{entry.sale_order_no || entry.purchase_order_no || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{entry.serial_no || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{entry.truck_no || '—'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{entry.tons ? `${parseFloat(entry.tons).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatAmount(entry.amount)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--color-success)' }}>{formatAmount(entry.paid_amount)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: entry.remaining_amount > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>{formatAmount(entry.remaining_amount)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      display: 'inline-block', padding: '0.125rem 0.375rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600,
                      backgroundColor: entry.status === 'PAID' ? 'var(--color-success)' : entry.status === 'PARTIALLY_PAID' ? 'var(--color-warning)' : 'var(--color-danger)', color: 'white'
                    }}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      setSelectedLedgerEntry(entry);
                      setIsDetailsModalOpen(true);
                    }}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLedgerEntry && (
        <RecordPaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedLedgerEntry(null);
          }}
          ledgerEntry={selectedLedgerEntry}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            setSelectedLedgerEntry(null);
            onRefresh();
            loadEntries();
          }}
        />
      )}

      {selectedLedgerEntry && (
        <EntryDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedLedgerEntry(null);
            onRefresh();
            loadEntries();
          }}
          ledgerEntry={selectedLedgerEntry}
          onRecordPaymentClick={() => {
            setIsDetailsModalOpen(false);
            setIsPaymentModalOpen(true);
          }}
          onUpdate={() => {
            onRefresh();
            loadEntries();
          }}
        />
      )}
    </div>
  );
}

// ── Customer Overview Summary ──────────────────────────────────
function CustomerOverviewSummary({ customer }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Fetch all for accurate totals. In production with thousands of entries, this would be a backend aggregation.
    ledgerApi.getLedgerEntries({ customer: customer.id })
      .then(res => setEntries(res.data.results || res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customer.id]);

  if (loading) return <div className="loading-state"><span className="spinner" /> Loading summary...</div>;

  const totalOrders = entries.length;
  const totalTrucks = entries.filter(e => e.truck_no).length;
  const totalTons = entries.reduce((acc, curr) => acc + (parseFloat(curr.tons) || 0), 0);
  
  const toReceive = entries.filter(e => e.transaction_type === 'RECEIVABLE');
  const toPay = entries.filter(e => e.transaction_type === 'PAYABLE');

  const totalInvoiced = toReceive.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const stillToReceive = toReceive.reduce((acc, curr) => acc + (parseFloat(curr.remaining_amount) || 0), 0);
  
  const stillToPay = toPay.reduce((acc, curr) => acc + (parseFloat(curr.remaining_amount) || 0), 0);

  const formatAmount = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt || 0);

  const recentActivity = [...entries]
    .sort((a, b) => new Date(b.entry_date || b.created_at) - new Date(a.entry_date || a.created_at))
    .slice(0, 5);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
      <div className="card" style={{ margin: 0 }}>
        <div className="card-title">Customer Summary</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total Orders</span>
            <span style={{ fontWeight: 600 }}>{totalOrders}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total Trucks</span>
            <span style={{ fontWeight: 600 }}>{totalTrucks}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total Tons</span>
            <span style={{ fontWeight: 600 }}>{totalTons.toFixed(2)} MTS</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Total Amount</span>
            <span style={{ fontWeight: 600 }}>{formatAmount(totalInvoiced)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Still To Receive</span>
            <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{formatAmount(stillToReceive)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Still To Pay</span>
            <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{formatAmount(stillToPay)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ margin: 0 }}>
        <div className="card-title">Recent Activity</div>
        {recentActivity.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No recent activity.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentActivity.map(entry => (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    {entry.transaction_type === 'RECEIVABLE' ? 'To Receive' : 'To Pay'} - {entry.sale_order_no || entry.purchase_order_no || entry.reference || 'Entry'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {entry.truck_no ? `Truck ${entry.truck_no}` : (entry.tons ? `${entry.tons} MTS` : 'No details')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: entry.transaction_type === 'RECEIVABLE' ? 'var(--color-success)' : 'var(--color-text)' }}>
                    {formatAmount(entry.amount)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {new Date(entry.entry_date || entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── New Customer form ─────────────────────────────────────────
function CustomerForm({ onSaved }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  
  const [verifyingGst, setVerifyingGst] = useState(false);
  const [gstVerifyMsg, setGstVerifyMsg] = useState(null); // { type: 'success'|'error', text: '...' }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === 'checkbox' ? checked : value;
    if (name === 'gst_registered') val = value === 'true';

    if (name === 'state') {
      const code = getStateCode(val);
      setForm((p) => ({ ...p, state: val, state_code: code }));
    } else if (name === 'gst_registered') {
      setForm((p) => ({ ...p, gst_registered: val, gstin: val ? p.gstin : '', aadhaar_no: !val ? p.aadhaar_no : '' }));
    } else if (name === 'gstin') {
      setForm((p) => ({ ...p, gstin: val, gst_verified: false, gst_status: '', gst_legal_name: '', gst_trade_name: '' }));
      setGstVerifyMsg(null);
    } else {
      setForm((p) => ({ ...p, [name]: val }));
    }
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleVerifyGSTIN = async () => {
    let cleanGstin = (form.gstin || '').trim().toUpperCase();
    if (!cleanGstin) {
      setGstVerifyMsg({ type: 'error', text: 'Please enter a GSTIN first.' });
      return;
    }
    if (cleanGstin.length !== 15) {
      setGstVerifyMsg({ type: 'error', text: 'GSTIN must be exactly 15 characters.' });
      return;
    }

    setVerifyingGst(true);
    setGstVerifyMsg(null);
    try {
      const res = await verifyGSTIN(cleanGstin);
      const data = res.data;
      if (data.success && data.data) {
        const result = data.data;
        const newName = result.trade_name || result.legal_name || form.name;
        const newAddress = result.address || form.address;
        const newState = result.state || form.state;
        
        let newStateCode = form.state_code;
        if (result.state) {
           newStateCode = getStateCode(result.state) || form.state_code;
        }

        setForm(p => ({
          ...p,
          gstin: cleanGstin,
          gst_verified: true,
          gst_status: result.status || '',
          gst_legal_name: result.legal_name || '',
          gst_trade_name: result.trade_name || '',
          name: newName,
          address: newAddress,
          state: newState,
          state_code: newStateCode
        }));
        
        setGstVerifyMsg({ 
          type: 'success', 
          text: `✓ GSTIN Verified${result.status ? ` (Status: ${result.status})` : ''}` 
        });
      } else {
        setGstVerifyMsg({ type: 'error', text: `❌ ${data.error || 'Failed to verify GSTIN.'}` });
      }
    } catch (err) {
      setGstVerifyMsg({ 
        type: 'error', 
        text: `⚠️ GST verification service is temporarily unavailable. Please try again.` 
      });
    } finally {
      setVerifyingGst(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);

    const payload = { ...form };
    
    // Aadhaar frontend validation for unregistered
    if (!payload.gst_registered) {
      const cleanedAadhaar = (payload.aadhaar_no || '').replace(/\s/g, '');
      if (!/^\d{12}$/.test(cleanedAadhaar)) {
        setErrors({ aadhaar_no: 'Aadhaar Number must be exactly 12 digits' });
        setAlert({ type: 'error', message: 'Please fix the errors below.' });
        return;
      }
      payload.aadhaar_no = cleanedAadhaar;
      payload.gstin = '';
    } else {
      payload.aadhaar_no = '';
    }

    setSaving(true);
    try {
      const res = await createCustomer(payload);
      navigate(`/customers/${res.data.id}`);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data) {
        setErrors(extractErrors(data));
        setAlert({ type: 'error', message: 'Please fix the errors below.' });
      } else {
        setAlert({ type: 'error', message: data?.detail || 'Failed to save. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => navigate('/customers')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 className="page-title">Add Customer</h1>
          <p className="page-subtitle">Create a new customer record</p>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card">
          <div className="card-title">Customer Details</div>
          <div className="form-grid">
            <FormField label="Customer Name" name="name" id="customer_name" required
              value={form.name} onChange={handleChange} error={errors.name}
              placeholder="e.g. Sri Hanuman Bricks" />
            

              
            <div className="form-field span-2">
              <label>GST Registration <span className="required">*</span></label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input type="radio" name="gst_registered" value="true" checked={form.gst_registered === true} onChange={handleChange} />
                  GST Registered
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                  <input type="radio" name="gst_registered" value="false" checked={form.gst_registered === false} onChange={handleChange} />
                  Unregistered
                </label>
              </div>
              <div className="help-text" style={{ marginTop: '0.25rem' }}>
                {form.gst_registered ? "Select GST Registered only if the customer has a valid GST registration." : "No GSTIN is required for an unregistered customer."}
              </div>
            </div>

            {form.gst_registered ? (
              <div className="form-field">
                <label htmlFor="customer_gstin">
                  GSTIN <span className="required">*</span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      id="customer_gstin"
                      name="gstin"
                      value={form.gstin}
                      onChange={handleChange}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      maxLength={15}
                      className={`form-input ${errors.gstin ? 'error' : ''}`}
                    />
                    {errors.gstin && <p className="form-error">{errors.gstin}</p>}
                    {gstVerifyMsg && (
                      <p style={{ 
                        marginTop: '0.25rem', 
                        fontSize: '0.85rem', 
                        color: gstVerifyMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
                      }}>
                        {gstVerifyMsg.text}
                      </p>
                    )}
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleVerifyGSTIN}
                    disabled={verifyingGst}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {verifyingGst ? 'Verifying...' : 'Verify GSTIN'}
                  </button>
                </div>
              </div>
            ) : (
              <FormField label="Aadhaar Number" name="aadhaar_no" id="customer_aadhaar" required
                value={form.aadhaar_no} onChange={handleChange} error={errors.aadhaar_no}
                placeholder="e.g. 1234 5678 9012" maxLength={14} />
            )}
            <FormField label="Phone" name="phone" id="customer_phone" type="tel"
              value={form.phone} onChange={handleChange} error={errors.phone}
              placeholder="e.g. 9876543210" />
            <div className="form-field">
              <label htmlFor="customer_state">State</label>
              <select
                id="customer_state"
                name="state"
                value={form.state}
                onChange={handleChange}
                className={`form-control ${errors.state ? 'error' : ''}`}
              >
                <option value="">-- Select State --</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.state && <div className="error-msg">{errors.state}</div>}
            </div>
            <FormField label="State Code" name="state_code" id="customer_state_code"
              value={form.state_code} readOnly help="Derived automatically" />
            <div className="form-field span-2">
              <FormField label="Address" name="address" id="customer_address" as="textarea"
                value={form.address} onChange={handleChange} error={errors.address}
                placeholder="Full billing address" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/customers')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} id="save-customer-btn">
            {saving ? (
              <><span className="spinner" /> Saving…</>
            ) : (
              <><Save size={16} /> Save Customer</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Customer Detail / Edit ─────────────────────────────────────
function CustomerDetail({ id }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  
  const [verifyingGst, setVerifyingGst] = useState(false);
  const [gstVerifyMsg, setGstVerifyMsg] = useState(null);

  const loadCustomer = () => {
    setLoading(true);
    getCustomer(id)
      .then((res) => {
        setCustomer(res.data);
        setForm({
          name:       res.data.name       ?? '',
          party_type: res.data.party_type ?? 'CUSTOMER',
          address:    res.data.address    ?? '',
          gst_registered: res.data.gst_registered ?? false,
          gstin:      res.data.gstin      ?? '',
          gst_verified: res.data.gst_verified ?? false,
          gst_status: res.data.gst_status ?? '',
          gst_legal_name: res.data.gst_legal_name ?? '',
          gst_trade_name: res.data.gst_trade_name ?? '',
          aadhaar_no: res.data.aadhaar_no ?? '',
          state:      res.data.state      ?? '',
          state_code: res.data.state_code ?? '',
          phone:      res.data.phone      ?? '',
        });
      })
      .catch(() => setAlert({ type: 'error', message: 'Customer not found.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCustomer(); }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === 'checkbox' ? checked : value;
    if (name === 'gst_registered') val = value === 'true';

    if (name === 'state') {
      const code = getStateCode(val);
      setForm((p) => ({ ...p, state: val, state_code: code }));
    } else if (name === 'gst_registered') {
      setForm((p) => ({ ...p, gst_registered: val, gstin: val ? p.gstin : '', aadhaar_no: !val ? p.aadhaar_no : '' }));
    } else {
      setForm((p) => ({ ...p, [name]: val }));
    }
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
    if (name === 'gstin') setGstVerifyMsg(null);
  };

  const handleVerifyGSTIN = async () => {
    let cleanGstin = (form.gstin || '').trim().toUpperCase();
    if (!cleanGstin) {
      setGstVerifyMsg({ type: 'error', text: 'Please enter a GSTIN first.' });
      return;
    }
    if (cleanGstin.length !== 15) {
      setGstVerifyMsg({ type: 'error', text: 'GSTIN must be exactly 15 characters.' });
      return;
    }

    setVerifyingGst(true);
    setGstVerifyMsg(null);
    try {
      const res = await verifyGSTIN(cleanGstin);
      const data = res.data;
      if (data.success && data.data) {
        const result = data.data;
        const newName = result.trade_name || result.legal_name || form.name;
        const newAddress = result.address || form.address;
        const newState = result.state || form.state;
        
        let newStateCode = form.state_code;
        if (result.state) {
           newStateCode = getStateCode(result.state) || form.state_code;
        }

        setForm(p => ({
          ...p,
          gstin: cleanGstin,
          name: newName,
          address: newAddress,
          state: newState,
          state_code: newStateCode
        }));
        
        setGstVerifyMsg({ 
          type: 'success', 
          text: `✓ GSTIN Verified${result.status ? ` (Status: ${result.status})` : ''}` 
        });
      } else {
        setGstVerifyMsg({ type: 'error', text: `❌ ${data.error || 'Failed to verify GSTIN.'}` });
      }
    } catch (err) {
      setGstVerifyMsg({ 
        type: 'error', 
        text: `⚠️ GST verification service is temporarily unavailable. Please try again.` 
      });
    } finally {
      setVerifyingGst(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);

    const payload = { ...form };
    
    if (!payload.gst_registered) {
      const cleanedAadhaar = (payload.aadhaar_no || '').replace(/\s/g, '');
      if (!/^\d{12}$/.test(cleanedAadhaar)) {
        setErrors({ aadhaar_no: 'Aadhaar Number must be exactly 12 digits' });
        setAlert({ type: 'error', message: 'Please fix the errors below.' });
        return;
      }
      payload.aadhaar_no = cleanedAadhaar;
      payload.gstin = '';
    } else {
      payload.aadhaar_no = '';
    }

    setSaving(true);
    try {
      const res = await updateCustomer(id, payload);
      setCustomer(res.data);
      setEditing(false);
      setAlert({ type: 'success', message: 'Customer updated successfully.' });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data) {
        setErrors(extractErrors(data));
        setAlert({ type: 'error', message: 'Please fix the errors below.' });
      } else {
        setAlert({ type: 'error', message: data?.detail || 'Failed to update customer.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setActionLoading(true);
    setAlert(null);
    try {
      await deactivateCustomer(id);
      setCustomer((p) => ({ ...p, is_active: false }));
      setAlert({ type: 'success', message: 'Customer deactivated.' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to deactivate.' });
    } finally {
      setActionLoading(false);
      setConfirmDeactivate(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    setAlert(null);
    try {
      await reactivateCustomer(id);
      setCustomer((p) => ({ ...p, is_active: true }));
      setAlert({ type: 'success', message: 'Customer reactivated.' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to reactivate.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="page-content">
      <div className="loading-state"><div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />Loading…</div>
    </div>
  );

  if (!customer && !loading) return (
    <div className="page-content">
      <div className="alert alert-error">Customer not found.</div>
      <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to Customers</button>
    </div>
  );

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => navigate('/customers')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h1 className="page-title">{customer.name}</h1>
            <StatusBadge isActive={customer.is_active} />
          </div>
          <p className="page-subtitle">
            Customer since {new Date(customer.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {!editing && (
          <button className="btn btn-secondary" id="edit-customer-btn" onClick={() => { setEditing(true); setAlert(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Edit2 size={16} /> Edit
          </button>
        )}
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* View / Edit */}
      {editing ? (
        <form onSubmit={handleSave} noValidate>
          <div className="card">
            <div className="card-title">Edit Customer</div>
            <div className="form-grid">
              <FormField label="Customer Name" name="name" id="edit_name" required value={form.name} onChange={handleChange} error={errors.name} />
              
              <div className="form-field">
                <label htmlFor="edit_party_type">Party Type *</label>
                <select
                  id="edit_party_type"
                  name="party_type"
                  value={form.party_type}
                  onChange={handleChange}
                  className={`form-control ${errors.party_type ? 'error' : ''}`}
                  required
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="TRANSPORTER">Transporter</option>
                  <option value="OTHER">Other</option>
                </select>
                {errors.party_type && <div className="error-msg">{errors.party_type}</div>}
              </div>

              <div className="form-field span-2">
                <label>GST Registration *</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                    <input type="radio" name="gst_registered" value="true" checked={form.gst_registered === true} onChange={handleChange} />
                    GST Registered
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                    <input type="radio" name="gst_registered" value="false" checked={form.gst_registered === false} onChange={handleChange} />
                    Unregistered
                  </label>
                </div>
              </div>

              {form.gst_registered ? (
                <div className="form-field">
                  <label htmlFor="edit_gstin">
                    GSTIN <span className="required">*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        id="edit_gstin"
                        name="gstin"
                        value={form.gstin}
                        onChange={handleChange}
                        maxLength={15}
                        className={`form-input ${errors.gstin ? 'error' : ''}`}
                      />
                      {errors.gstin && <p className="form-error">{errors.gstin}</p>}
                      {gstVerifyMsg && (
                        <p style={{ 
                          marginTop: '0.25rem', 
                          fontSize: '0.85rem', 
                          color: gstVerifyMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
                        }}>
                          {gstVerifyMsg.text}
                        </p>
                      )}
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleVerifyGSTIN}
                      disabled={verifyingGst}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {verifyingGst ? 'Verifying...' : 'Verify GSTIN'}
                    </button>
                  </div>
                </div>
              ) : (
                <FormField label="Aadhaar Number" name="aadhaar_no" id="edit_aadhaar" required
                  value={form.aadhaar_no} onChange={handleChange} error={errors.aadhaar_no}
                  placeholder="e.g. 1234 5678 9012" maxLength={14} />
              )}
              <FormField label="Phone" name="phone" id="edit_phone" type="tel" value={form.phone} onChange={handleChange} error={errors.phone} />
              <div className="form-field">
                <label htmlFor="edit_state">State</label>
                <select
                  id="edit_state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={`form-control ${errors.state ? 'error' : ''}`}
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.state && <div className="error-msg">{errors.state}</div>}
              </div>
              <FormField label="State Code" name="state_code" id="edit_state_code" value={form.state_code} readOnly help="Derived automatically" />
              <div className="form-field span-2">
                <FormField label="Address" name="address" id="edit_address" as="textarea" value={form.address} onChange={handleChange} error={errors.address} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setErrors({}); setAlert(null); setGstVerifyMsg(null); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="save-edit-customer-btn">
              {saving ? <><span className="spinner" /> Saving…</> : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
            {['overview', 'sales', 'invoices', 'ledger'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="card">
                <div className="card-title">Customer Information</div>
                {[
                  ['Name', customer.name],
                  ['Status', <StatusBadge active={customer.is_active} />],
                  ['GST Status', customer.gst_registered ? 'GST Registered' : 'Unregistered'],
                  ['GSTIN', customer.gst_registered ? customer.gstin : 'Not Applicable'],
                  ['Aadhaar Number', customer.gst_registered ? 'Not Applicable' : (customer.aadhaar_no ? `XXXX XXXX ${customer.aadhaar_no.slice(-4)}` : 'Not provided')],
                  ['Phone', customer.phone || '—'],
                  ['State', customer.state || '—'],
                  ['State Code', customer.state_code || '—'],
                  ['Address', customer.address || '—'],
                ].map(([label, value]) => (
                  <div className="detail-row" key={label}>
                    <span className="detail-label">{label}</span>
                    <span className={`detail-value${!value ? ' muted' : ''}`}>
                      {value || 'Not provided'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Deactivate / Reactivate */}
              <div className="card">
                <div className="card-title">Customer Status</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <StatusBadge isActive={customer.is_active} />
                    </div>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      {customer.is_active
                        ? 'This customer is active and can be selected for new invoices.'
                        : 'This customer is inactive and will not appear in invoice selection. Historical invoices are preserved.'}
                    </p>
                  </div>

                  {customer.is_active ? (
                    confirmDeactivate ? (
                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Are you sure?</span>
                        <button className="btn btn-danger btn-sm" disabled={actionLoading} onClick={handleDeactivate} id="confirm-deactivate-btn">
                          {actionLoading ? <span className="spinner" /> : 'Yes, Deactivate'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeactivate(false)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-danger btn-sm" id="deactivate-customer-btn" onClick={() => setConfirmDeactivate(true)}>
                        Deactivate Customer
                      </button>
                    )
                  ) : (
                    <button className="btn btn-success btn-sm" disabled={actionLoading} id="reactivate-customer-btn" onClick={handleReactivate}>
                      {actionLoading ? <span className="spinner" /> : 'Reactivate Customer'}
                    </button>
                  )}
                </div>
              </div>
              <CustomerOverviewSummary customer={customer} />
            </>
          )}

          {activeTab === 'sales' && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Sales History</span>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => navigate(`/sales?customer=${id}`)}
                >
                  View in Sales
                </button>
              </div>
              <CustomerSaleHistory customerId={id} />
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Invoice History</span>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => navigate(`/invoices?customer=${id}`)}
                >
                  View in Invoices
                </button>
              </div>
              <CustomerInvoiceHistory customerId={id} />
            </div>
          )}

          {activeTab === 'ledger' && (
            <CustomerLedgerHistory customer={customer} onRefresh={loadCustomer} />
          )}
        </>
      )}
    </div>
  );
}

// ── Router entry-point ─────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams();
  if (id === 'new') return <CustomerForm />;
  return <CustomerDetail id={id} />;
}
