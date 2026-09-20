import { useState, useEffect, useCallback, useMemo } from 'react';
import { getBusinessDashboard } from '../api/dashboard';
import { TrendingUp, TrendingDown, DollarSign, Info, ChevronDown, ChevronUp } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/layout/PageHeader';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amount || 0);
};

export default function ProfitLoss() {
  const [dateRange, setDateRange] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Compute the active date range string for display
  const activeDateString = useMemo(() => {
    if (dateRange === 'Custom Range') {
      if (customStart && customEnd) {
        return `${new Date(customStart).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})} – ${new Date(customEnd).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`;
      }
      return 'Custom Range';
    }
    return dateRange;
  }, [dateRange, customStart, customEnd]);

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
      if (!customStart || !customEnd) return; 
      params = { start_date: customStart, end_date: customEnd };
    }

    getBusinessDashboard(params)
      .then(res => setData(res.data))
      .catch(() => setError("Unable to load profit & loss summary. Please try again."))
      .finally(() => setLoading(false));
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (error) {
    return <div className="page-content"><div className="alert alert-error">{error}</div></div>;
  }

  // Edge cases flags
  const salesValue = data ? Number(data.financials.sales_value) : 0;
  const soldQty = data ? Number(data.quantities.sold) : 0;
  const avgPurchaseRate = data ? Number(data.rates.avg_purchase_rate) : 0;
  
  const hasNoSales = !loading && data && salesValue === 0 && soldQty === 0;
  const missingPurchaseData = !loading && data && salesValue > 0 && avgPurchaseRate === 0;
  
  const netProfit = data ? Number(data.financials.net_profit) : 0;
  const isLoss = netProfit < 0;

  return (
    <div className="page-content" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader 
        title="Profit & Loss"
        description={<>
          <span style={{ color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{activeDateString}</span>
          See how much you sold, what it cost, what you spent, and your estimated profit.
        </>}
        action={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
            <button className="btn btn-secondary">Download PDF</button>
          </div>
        }
      />

      {loading ? (
        <div className="loading-state"><div className="spinner" style={{ margin: '0 auto var(--space-3)' }} /> Loading financial data...</div>
      ) : hasNoSales ? (
        <EmptyState
          icon={<DollarSign size={48} />}
          title="NO SALES RECORDED"
          message="There are no sales recorded for this period, so profit cannot be estimated yet."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* 1. TOP SUMMARY CARDS */}
          <div className="card-grid">
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
                <TrendingUp size={18} color="var(--color-primary)" />
                <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>SALES REVENUE</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1 }}>{formatCurrency(data.financials.sales_value)}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-faint)', marginTop: '0.5rem' }}>{Number(data.quantities.sold).toLocaleString()} MT coal sold</div>
            </div>
            
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
                <TrendingDown size={18} color="var(--color-warning)" />
                <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>COAL COST</span>
              </div>
              {missingPurchaseData ? (
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-warning)' }}>Data Unavailable</div>
              ) : (
                <>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1 }}>{formatCurrency(data.financials.estimated_cogs)}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-faint)', marginTop: '0.5rem' }}>Estimated purchase value</div>
                </>
              )}
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
                <DollarSign size={18} color="var(--color-danger)" />
                <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>OTHER EXPENSES</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1 }}>{formatCurrency(data.financials.operating_expenses)}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-faint)', marginTop: '0.5rem' }}>Operational costs this period</div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
                {isLoss ? <TrendingDown size={18} color="var(--color-danger)" /> : <TrendingUp size={18} color="var(--color-primary)" />}
                <span style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                  {isLoss ? 'ESTIMATED LOSS' : 'ESTIMATED PROFIT'}
                </span>
              </div>
              {missingPurchaseData ? (
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-warning)' }}>Data Unavailable</div>
              ) : (
                <>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: isLoss ? 'var(--color-danger)' : 'var(--color-primary)', lineHeight: 1.1 }}>
                    {isLoss ? `- ${formatCurrency(Math.abs(netProfit))}` : formatCurrency(netProfit)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: isLoss ? 'var(--color-danger)' : 'var(--color-primary)', marginTop: '0.5rem', opacity: 0.8 }}>Approximate net earnings</div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '2rem', alignItems: 'start' }}>
            
            {/* 2. VISUAL CALCULATION FLOW */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.5rem' }}>
                <TrendingUp size={18} color="var(--color-primary)" />
                <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>PROFIT CALCULATION</span>
              </div>
              
              {missingPurchaseData ? (
                <div className="alert alert-warning">
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>ESTIMATED COAL COST</div>
                  <div>Purchase cost information is not available for all sold coal.</div>
                  <div style={{ marginTop: '1rem', fontWeight: 600 }}>Profit estimate unavailable</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', color: 'var(--color-text-muted)' }}>Revenue from Sales</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(data.financials.sales_value)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', color: 'var(--color-text-muted)' }}>Estimated Coal Cost</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>− {formatCurrency(data.financials.estimated_cogs)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text)' }}>Gross Profit</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(data.financials.gross_profit)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', color: 'var(--color-text-muted)' }}>Operating Expenses</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>− {formatCurrency(data.financials.operating_expenses)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: isLoss ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                      {isLoss ? 'ESTIMATED LOSS' : 'NET PROFIT'}
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: isLoss ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                      {isLoss ? `- ${formatCurrency(Math.abs(netProfit))}` : formatCurrency(netProfit)}
                    </span>
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>PROFIT MARGIN</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)' }}>{data.financials.net_margin}%</div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* 3. BUSINESS SUMMARY */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
                  <Info size={18} color="var(--color-primary)" />
                  <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>PERIOD AT A GLANCE</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--color-text-muted)' }}>
                  <div>You sold <strong style={{ color: 'var(--color-text)' }}>{Number(data.quantities.sold).toLocaleString()} MT</strong> of coal.</div>
                  <div>Sales brought in <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(data.financials.sales_value)}</strong>.</div>
                  {!missingPurchaseData && (
                    <div>The estimated coal cost was <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(data.financials.estimated_cogs)}</strong>.</div>
                  )}
                  <div>You spent <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(data.financials.operating_expenses)}</strong> on business expenses.</div>
                  {!missingPurchaseData && (
                    <div style={{ marginTop: '0.5rem', fontWeight: 600, color: isLoss ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      You {isLoss ? 'made an estimated loss of' : 'earned an estimated profit of'} {formatCurrency(Math.abs(netProfit))}.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. EXPENSE BREAKDOWN */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: 'none', paddingBottom: '0', marginBottom: '1.25rem' }}>
                  <DollarSign size={18} color="#f97316" />
                  <span style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>EXPENSE BREAKDOWN</span>
                </div>
                
                {Object.keys(data.summaries.expense_breakdown).length === 0 ? (
                  <div style={{ color: 'var(--color-text-faint)' }}>No business expenses recorded for this period.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {Object.entries(data.summaries.expense_breakdown).map(([category, amount]) => (
                      <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text)' }}>
                        <span style={{ fontSize: '1rem' }}>{category}</span>
                        <span style={{ fontSize: '1rem', fontWeight: 600 }}>{formatCurrency(amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>Total:</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>{formatCurrency(data.financials.operating_expenses)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. COAL MOVEMENT */}
              <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--color-bg-subtle)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Coal Movement</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem' }}>Purchased:</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>{Number(data.quantities.purchased).toLocaleString()} MT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem' }}>Sold:</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>{Number(data.quantities.sold).toLocaleString()} MT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>Current stock:</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{Number(data.quantities.current_stock).toLocaleString()} MT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 6. EXPLANATION ACCORDION */}
          {!missingPurchaseData && (
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <button 
                onClick={() => setShowExplanation(!showExplanation)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  <Info size={18} />
                  <span>How was this calculated?</span>
                </div>
                {showExplanation ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
              </button>
              
              {showExplanation && (
                <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--color-border)', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem', maxWidth: '600px', margin: '1rem auto 0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sales:</span> <span>{formatCurrency(data.financials.sales_value)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Estimated coal cost:</span> <span>{formatCurrency(data.financials.estimated_cogs)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <span>Profit before expenses:</span> <span>{formatCurrency(data.financials.gross_profit)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <span>Business expenses:</span> <span>{formatCurrency(data.financials.operating_expenses)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem', marginTop: '0.25rem', color: isLoss ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      <span>Estimated profit:</span> <span>{isLoss ? `- ${formatCurrency(Math.abs(netProfit))}` : formatCurrency(netProfit)}</span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-faint)', marginTop: '1.5rem', textAlign: 'center', fontStyle: 'italic' }}>
                    Coal cost is estimated from recorded purchase data and the costing method used by the application. This is a business estimate, not a formal audited accounting statement.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
