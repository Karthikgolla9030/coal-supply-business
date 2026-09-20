import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, Clock, CheckCircle, RefreshCw, Calendar, ArrowUpRight, ArrowDownRight, AlertCircle, ArrowRight } from 'lucide-react';
import { ledgerApi } from '../../api/ledger';
import { Link } from 'react-router-dom';

export default function LedgerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState('ALL_TIME');
  const [searchQuery, setSearchQuery] = useState('');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      let filters = {};
      
      const today = new Date();
      if (dateFilter === 'THIS_MONTH') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        filters.start_date = start.toISOString().split('T')[0];
        filters.end_date = today.toISOString().split('T')[0];
      } else if (dateFilter === 'LAST_MONTH') {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        filters.start_date = start.toISOString().split('T')[0];
        filters.end_date = end.toISOString().split('T')[0];
      } else if (dateFilter === 'CUSTOM' && customDates.start && customDates.end) {
        filters.start_date = customDates.start;
        filters.end_date = customDates.end;
      }

      const res = await ledgerApi.getLedgerDashboard(filters);
      setData(res.data || res);
    } catch (err) {
      setError("Failed to load financial overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFilter === 'CUSTOM' && (!customDates.start || !customDates.end)) {
      return; 
    }
    fetchDashboard();
  }, [dateFilter, customDates]);

  const recentActivity = useMemo(() => {
    const activities = [];
    const pmts = data?.recent_payments || [];
    const invs = data?.recent_invoices || [];
    
    pmts.forEach(p => {
      activities.push({
        id: `pay-${p.id}`,
        date: p.payment_date,
        rawDate: new Date(p.payment_date),
        label: p.transaction_type === 'RECEIVABLE' ? 'Payment Received' : 'Payment Made',
        party: p.party_name,
        reference: p.reference || '—',
        amount: p.amount,
        isPositive: p.transaction_type === 'RECEIVABLE',
        status: p.status || 'PAID'
      });
    });

    invs.forEach(inv => {
      activities.push({
        id: `inv-${inv.id}`,
        date: inv.invoice_date || inv.created_at?.split('T')[0],
        rawDate: new Date(inv.invoice_date || inv.created_at),
        label: 'Invoice Created',
        party: inv.customer_name,
        reference: inv.invoice_number || `INV-${inv.id}`,
        amount: inv.total_amount,
        isPositive: true,
        status: inv.ledger_status || 'PENDING'
      });
    });

    activities.sort((a, b) => b.rawDate - a.rawDate);
    return activities.slice(0, 5);
  }, [data]);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const statusColors = {
    PENDING: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)', border: '1px solid var(--color-danger-border)', label: 'PENDING' },
    PARTIALLY_PAID: { bg: 'var(--color-warning-soft)', text: 'var(--color-warning)', border: '1px solid var(--color-warning-border)', label: 'PARTIALLY PAID' },
    PAID: { bg: 'var(--color-success-soft)', text: 'var(--color-success)', border: '1px solid var(--color-success-border)', label: 'PAID' },
    VOIDED: { bg: 'var(--color-surface-2)', text: 'var(--color-text-muted)', border: '1px solid var(--color-border)', label: 'VOIDED' }
  };

  if (loading && !data) {
    return <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading financial overview...</div>;
  }

  if (error) {
    return (
      <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.5rem' }}>
        <AlertCircle size={18} /> {error}
        <button className="btn btn-sm btn-secondary" onClick={fetchDashboard} style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem' }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const {
    to_receive = 0,
    to_pay = 0,
    received = 0,
    paid = 0,
    net_position = 0,
    recent_payments = [],
    recent_invoices = [],
    status_distribution = { PENDING: 0, PARTIALLY_PAID: 0, PAID: 0 }
  } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Controls: Date Filter & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Calendar size={18} style={{ color: 'var(--color-text-muted)' }} />
          <select 
            className="form-control" 
            style={{ width: 'auto' }}
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value)}
          >
            <option value="ALL_TIME">All Time</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
          {dateFilter === 'CUSTOM' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="date" className="form-control" style={{ width: 'auto' }} value={customDates.start} onChange={e => setCustomDates({...customDates, start: e.target.value})} />
              <span style={{ color: 'var(--color-text-muted)' }}>to</span>
              <input type="date" className="form-control" style={{ width: 'auto' }} value={customDates.end} onChange={e => setCustomDates({...customDates, end: e.target.value})} />
            </div>
          )}
        </div>
      </div>

      {/* Top Financial Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: 0, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CUSTOMERS STILL NEED TO PAY</div>
            <ArrowUpRight size={18} color="var(--color-primary-light)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-text)', lineHeight: 1 }}>{formatMoney(to_receive)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>Money you are yet to receive</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: 0, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>YOU STILL NEED TO PAY</div>
            <ArrowDownRight size={18} color="var(--color-warning)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-text)', lineHeight: 1 }}>{formatMoney(to_pay)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>Money you are yet to pay</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: 0, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RECEIVED</div>
            <TrendingUp size={18} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-text)', lineHeight: 1 }}>{formatMoney(received)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>Total received</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: 0, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAID</div>
            <TrendingDown size={18} color="var(--color-text-muted)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-text)', lineHeight: 1 }}>{formatMoney(paid)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>Total paid</div>
        </div>
      </div>

      {/* Financial Position */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: 0, border: '1px solid var(--color-border)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: 'var(--color-text)' }}>FINANCIAL POSITION</h3>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Still to receive</span>
            <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>{formatMoney(to_receive)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Still to pay</span>
            <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>{formatMoney(to_pay)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0 0 0' }}>
            <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>Net position</span>
            <span style={{ fontWeight: '700', fontSize: '1.125rem', color: 'var(--color-text)' }}>{formatMoney(net_position)}</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ padding: 0, marginBottom: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--color-text)' }}>RECENT ACTIVITY</h3>
        </div>
        <div style={{ padding: '0', overflowX: 'auto' }}>
          {recentActivity.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Activity</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Customer / Party</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Reference</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem 1.5rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text)' }}>
                      {a.date}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text)' }}>
                      {a.label}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'var(--color-text)' }}>
                      {a.party}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-muted)' }}>
                      {a.reference}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '600', color: a.isPositive ? 'var(--color-primary-light)' : 'var(--color-text)' }}>
                      {a.isPositive ? '+' : '−'} {formatMoney(a.amount)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                       <span style={{
                        display: 'inline-flex',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        backgroundColor: statusColors[a.status]?.bg || '#f3f4f6',
                        color: statusColors[a.status]?.text || '#374151',
                        border: statusColors[a.status]?.border || '1px solid transparent'
                      }}>
                        {statusColors[a.status]?.label || a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '0.875rem' }}>
              Your financial activity will appear here.
            </div>
          )}
        </div>
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>View All Transactions</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
