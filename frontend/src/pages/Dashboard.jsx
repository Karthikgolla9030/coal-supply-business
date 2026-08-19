import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardSummary } from '../api/dashboard';
import { FilePlus, Users, Building } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await getDashboardSummary();
        setData(response.data);
        setError(false);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h3 style={{ color: 'var(--color-text)', marginBottom: '1rem' }}>Unable to load dashboard data.</h3>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  const {
    total_invoices,
    total_sales,
    gst_recorded,
    total_customers,
    recent_invoices,
    business_profile_complete
  } = data;

  const ownerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Owner';

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle" style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)' }}>
            Welcome back, <strong style={{ color: 'var(--color-text)' }}>{ownerName}</strong><br/>
            Here's an overview of your coal business.
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/invoices/create')}
        >
          + New Invoice
        </button>
      </div>

      {/* Onboarding States */}
      {!business_profile_complete && (
        <div style={{
          backgroundColor: '#2a4365', // subtle blue-ish background
          border: '1px solid #2b6cb0',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ flex: '1 1 300px' }}>
            <h3 style={{ color: '#ebf8ff', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Complete your Business Profile</h3>
            <p style={{ color: '#bee3f8', margin: 0, fontSize: '0.95rem' }}>
              Add your business name, GSTIN, address, state and bank details to start generating professional invoices.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/business-profile')}
          >
            Complete Business Profile
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '2.5rem' 
      }}>
        {/* Total Invoices */}
        <div className="card" style={{ marginBottom: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Invoices</span>
          <span style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)' }}>{total_invoices}</span>
        </div>

        {/* Total Sales */}
        <div className="card" style={{ marginBottom: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Sales</span>
          <span style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(total_sales)}</span>
        </div>

        {/* GST Recorded */}
        <div className="card" style={{ marginBottom: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>GST Recorded</span>
          <span style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(gst_recorded)}</span>
        </div>

        {/* Customers */}
        <div className="card" style={{ marginBottom: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Customers</span>
          <span style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)' }}>{total_customers}</span>
        </div>
      </div>

      {/* Recent Invoices & Contextual Area */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Left Side: Recent Invoices */}
        <div style={{ flex: '1 1 600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Recent Invoices</h2>
            {total_invoices > 0 && (
              <Link to="/invoices" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
                View All →
              </Link>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {recent_invoices.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem' }}>Invoice No.</th>
                      <th style={{ padding: '1rem' }}>Customer</th>
                      <th style={{ padding: '1rem' }}>Date</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                          <Link to={`/invoices/${inv.id}`} style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{inv.customer?.name || '-'}</td>
                        <td style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{formatDate(inv.invoice_date)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(inv.total_amount)}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: inv.transaction_type === 'CASH' ? 'rgba(56, 161, 105, 0.2)' : 'rgba(49, 130, 206, 0.2)',
                            color: inv.transaction_type === 'CASH' ? '#9ae6b4' : '#90cdf4'
                          }}>
                            {inv.transaction_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--color-text)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>No invoices yet</h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  Create your first invoice to start recording your coal sales.
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/invoices/create')}>
                  + Create Invoice
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Quick Overview (Optional context area) */}
        <div style={{ flex: '1 1 300px' }}>
          {total_customers === 0 && business_profile_complete && (
             <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Customers</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>No customers added yet.</p>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/customers')}>
                  Add Customer
                </button>
             </div>
          )}
          
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ textAlign: 'left', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => navigate('/invoices/create')}>
                <FilePlus size={16} /> New Invoice
              </button>
              <button className="btn btn-secondary" style={{ textAlign: 'left', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => navigate('/customers')}>
                <Users size={16} /> Add Customer
              </button>
              <button className="btn btn-secondary" style={{ textAlign: 'left', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => navigate('/business-profile')}>
                <Building size={16} /> Edit Business Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
