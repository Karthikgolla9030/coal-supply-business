import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBusinessDashboard } from '../api/dashboard';
import PageHeader from '../components/layout/PageHeader';
import { 
  ShoppingCart, Tag, Package, Receipt, ArrowRight, Wallet, AlertTriangle, LayoutDashboard, TrendingUp
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import EmptyState from '../components/EmptyState';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amount || 0);
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(() => {
    setLoading(true);
    setError(null);

    let params = {};
    const today = new Date();
    
    if (dateRange === 'Today') {
      const d = today.toISOString().split('T')[0];
      params = { start_date: d, end_date: d };
    } else if (dateRange === 'This Week') {
      const first = today.getDate() - today.getDay();
      const firstDay = new Date(today.setDate(first)).toISOString().split('T')[0];
      const lastDay = new Date(today.setDate(first + 6)).toISOString().split('T')[0];
      params = { start_date: firstDay, end_date: lastDay };
    } else if (dateRange === 'This Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      params = { start_date: firstDay, end_date: lastDay };
    } else if (dateRange === 'Last Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
      params = { start_date: firstDay, end_date: lastDay };
    } else if (dateRange === 'This Quarter') {
      const quarter = Math.floor(today.getMonth() / 3);
      const firstDay = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
      params = { start_date: firstDay, end_date: lastDay };
    } else if (dateRange === 'This Year') {
      const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
      params = { start_date: firstDay, end_date: lastDay };
    } else if (dateRange === 'Custom Range') {
      if (!customStart || !customEnd) return; // wait till both are set
      params = { start_date: customStart, end_date: customEnd };
    }
    // "All Time" passes no dates.

    getBusinessDashboard(params)
      .then(res => setData(res.data))
      .catch(() => setError("Unable to load business summary. Please try again."))
      .finally(() => setLoading(false));
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (error) {
    return <div className="page-content"><div className="alert alert-error">{error}</div></div>;
  }

  const noActivity = !loading && data && 
                     Number(data.financials.sales_value) === 0 && 
                     Number(data.financials.purchase_cost) === 0 && 
                     Number(data.financials.operating_expenses) === 0;

  return (
    <div className="page-content">
      <PageHeader 
        title="Business Dashboard"
        description="Track your business performance and activity."
        action={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select className="form-input" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ width: 'auto' }}>
              <option>All Time</option>
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Quarter</option>
              <option>This Year</option>
              <option>Custom Range</option>
            </select>
            {dateRange === 'Custom Range' && (
              <>
                <input type="date" className="form-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span>to</span>
                <input type="date" className="form-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="loading-state"><div className="spinner" style={{ margin: '0 auto var(--space-3)' }} /> Loading business data...</div>
      ) : noActivity ? (
        <EmptyState
          icon={<LayoutDashboard size={48} />}
          title="NO BUSINESS ACTIVITY YET"
          message="No business activity has been recorded yet for this period."
          action={
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>Add Purchase</button>
              <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>Add Sale</button>
              <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>Add Expense</button>
            </div>
          }
        />
      ) : (
        <>
          {/* Key Metrics Row */}
          <div className="card-grid">
            
            {/* Purchases */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShoppingCart size={20} color="var(--color-primary)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Purchases</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>{formatCurrency(data.financials.purchase_cost)}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>{Number(data.quantities.purchased).toLocaleString()} MT Purchased</div>
              </div>
            </div>

            {/* Sales */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp size={20} color="var(--color-success)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sales</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>{formatCurrency(data.financials.sales_value)}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-success)' }}>{Number(data.quantities.sold).toLocaleString()} MT Sold</div>
              </div>
            </div>

            {/* Expenses */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wallet size={20} color="var(--color-danger)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Expenses</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
                  {formatCurrency(data.financials.operating_expenses)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>Operating Costs</div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Net Profit</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
                  {formatCurrency(data.financials.net_profit)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-warning)' }}>Margin: {data.financials.net_margin}%</div>
              </div>
            </div>
          </div>
          {/* Middle Row: Stock, GST, Quick Actions */}
          <div className="card-grid">
            {/* Stock Summary */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.5rem' }}>
                <Package size={18} color="var(--color-primary)" />
                <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>CURRENT STOCK</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Purchased</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Number(data.quantities.purchased).toLocaleString()} MT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Sold</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Number(data.quantities.sold).toLocaleString()} MT</span>
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Current Stock</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: Number(data.quantities.current_stock) < 0 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                    {Number(data.quantities.current_stock).toLocaleString()} MT
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                   <button className="btn" style={{ background: 'transparent', color: 'var(--color-primary)', padding: 0 }} onClick={() => navigate('/stock')}>
                     View Stock <ArrowRight size={16} />
                   </button>
                </div>
              </div>
            </div>

            {/* GST Summary */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.5rem' }}>
                <Receipt size={18} color="var(--color-primary)" />
                <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>GST SUMMARY</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>GST on Purchases</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(data.gst.purchase_gst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>GST on Sales</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(data.gst.sales_gst)}</span>
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Sales GST - Purchase GST</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                    {formatCurrency(data.gst.difference)}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: '0.5rem', textAlign: 'left' }}>
                  * Informational only. Not an audited tax calculation.
                </p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>QUICK ACTIONS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                <button className="btn" style={{ justifyContent: 'space-between', background: 'transparent', padding: '0.5rem 0', border: 'none', color: 'var(--color-text-muted)' }} onClick={() => navigate('/purchases/new')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <ShoppingCart size={18} color="var(--color-primary)" /> <span>Add Purchase</span>
                  </div>
                  <ArrowRight size={16} />
                </button>
                <button className="btn" style={{ justifyContent: 'space-between', background: 'transparent', padding: '0.5rem 0', border: 'none', color: 'var(--color-text-muted)' }} onClick={() => navigate('/sales/new')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Tag size={18} color="var(--color-primary)" /> <span>Add Sale</span>
                  </div>
                  <ArrowRight size={16} />
                </button>
                <button className="btn" style={{ justifyContent: 'space-between', background: 'transparent', padding: '0.5rem 0', border: 'none', color: 'var(--color-text-muted)' }} onClick={() => navigate('/expenses/new')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Wallet size={18} color="var(--color-primary)" /> <span>Add Expense</span>
                  </div>
                  <ArrowRight size={16} />
                </button>
                <button className="btn" style={{ justifyContent: 'space-between', background: 'transparent', padding: '0.5rem 0', border: 'none', color: 'var(--color-text-muted)' }} onClick={() => navigate('/reports')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> 
                    <span>View Reports</span>
                  </div>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
          {/* Charts & Activity */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            
            {/* Business Overview Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: '2 1 500px' }}>
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>BUSINESS OVERVIEW</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select className="form-input" style={{ width: 'auto', minHeight: '32px', padding: '0.25rem 2rem 0.25rem 0.5rem', fontSize: '0.75rem' }}>
                    <option>This Week</option>
                  </select>
                </div>
              </div>
              <div style={{ height: '300px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { name: 'Mon', sales: 4000, purchases: 2400 },
                      { name: 'Tue', sales: 3000, purchases: 1398 },
                      { name: 'Wed', sales: 2000, purchases: 9800 },
                      { name: 'Thu', sales: 2780, purchases: 3908 },
                      { name: 'Fri', sales: 1890, purchases: 4800 },
                      { name: 'Sat', sales: 2390, purchases: 3800 },
                      { name: 'Sun', sales: 3490, purchases: 4300 },
                    ]}
                    margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} 
                      itemStyle={{ color: '#FFFFFF' }}
                      labelStyle={{ color: '#9CA3AF' }}
                    />
                    <Line type="monotone" dataKey="sales" stroke="#2DD4BF" strokeWidth={2} dot={{ r: 4, fill: '#0A0A0A', stroke: '#2DD4BF', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="purchases" stroke="#6B7280" strokeWidth={2} dot={{ r: 4, fill: '#0A0A0A', stroke: '#6B7280', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }}></div> Sales (₹)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-text-muted)' }}></div> Purchases (₹)
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 300px' }}>
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>RECENT ACTIVITY</span>
                </div>
                <button className="btn" style={{ background: 'transparent', color: 'var(--color-primary)', padding: 0, height: 'auto', minHeight: '0' }} onClick={() => navigate('/reports')}>
                  View All
                </button>
              </div>
              
              {data.recent_activity.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '1rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No recent activity.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {data.recent_activity.slice(0, 5).map((act, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.75rem 0', borderBottom: i < Math.min(data.recent_activity.length, 5) - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }} onClick={() => {
                        if (act.type === 'SALE') navigate(`/sales/${act.id}`);
                        else if (act.type === 'PURCHASE') navigate(`/purchases/${act.id}`);
                        else if (act.type === 'EXPENSE') navigate(`/expenses/${act.id}`);
                      }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: act.type === 'SALE' ? 'var(--color-success-soft)' : act.type === 'PURCHASE' ? 'var(--color-primary-soft)' : 'var(--color-danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {act.type === 'SALE' ? <Tag size={16} color="var(--color-success)" /> : act.type === 'PURCHASE' ? <ShoppingCart size={16} color="var(--color-primary)" /> : <Receipt size={16} color="var(--color-danger)" />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 500, color: 'var(--color-text)', fontSize: '0.9rem' }}>
                            {act.type === 'SALE' ? 'Sale Entry Added' : act.type === 'PURCHASE' ? 'Purchase Entry Added' : 'Expense Entry Added'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {act.quantity ? `${Number(act.quantity).toLocaleString()} MT ` : ''}
                            {act.type === 'SALE' ? `to ${act.party}` : act.type === 'PURCHASE' ? `from ${act.party}` : `${act.party}`}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                         <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {new Date(act.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                         </span>
                         <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                            {formatCurrency(act.amount)}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
