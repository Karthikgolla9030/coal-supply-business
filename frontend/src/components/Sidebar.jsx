import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, FilePlus, Users, Building, LogOut, Wallet, Truck, ShoppingCart, Tag, Package, Receipt, TrendingUp, BarChart2 } from 'lucide-react';

const navItems = [
  {
    group: 'Business',
    links: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
      { to: '/sales', label: 'Sales', icon: Tag },
      { to: '/stock', label: 'Stock', icon: Package },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/profit-loss', label: 'Profit & Loss', icon: TrendingUp },
      { to: '/reports', label: 'Reports', icon: BarChart2 },
      { to: '/business-profile', label: 'Business Profile', icon: Building },
    ],
  },
  {
    group: 'Invoices',
    links: [
      { to: '/invoices', label: 'All Invoices', icon: FileText, end: true },
      { to: '/invoices/new', label: 'New Invoice', icon: FilePlus },
    ],
  },
  {
    group: 'Finance',
    links: [
      { to: '/ledger', label: 'Money & Ledger', icon: Wallet },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ color: 'var(--color-primary)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l9 4.9V17L12 22l-9-4.9V7z"/><path d="M12 22V12"/><path d="M12 12L3 7"/><path d="M21 7l-9 5"/></svg>
          </div>
          <div>
            <div className="sidebar-logo-title">
              <span style={{ color: 'var(--color-primary)' }}>COAL</span> INVOICE
            </div>
            <div className="sidebar-logo-sub">Records Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.group}>
              <div className="sidebar-section-label">{section.group}</div>
              {section.links.map((link) => {
                const IconComponent = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `sidebar-link${isActive ? ' active' : ''}`
                    }
                  >
                    <IconComponent size={18} className="sidebar-link-icon" />
                    {link.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div style={{ marginTop: 'auto', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)' }}>
        {user && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(45,212,191,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
              {user.first_name ? user.first_name[0].toUpperCase() : user.username[0].toUpperCase()}{user.last_name ? user.last_name[0].toUpperCase() : ''}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <div style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: '500' }}>
                {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
              </div>
              {user.email && user.email !== user.username ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{user.email}</div>
              ) : (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Administrator</div>
              )}
            </div>
          </div>
        )}
        <button
          className="btn btn-secondary w-full"
          style={{ justifyContent: 'center', backgroundColor: 'transparent', border: '1px solid var(--color-border)' }}
          onClick={logout}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-danger-soft)'; e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.borderColor = 'var(--color-danger)'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );
}
