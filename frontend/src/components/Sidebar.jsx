import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, FilePlus, Users, Building, LogOut } from 'lucide-react';

const navItems = [
  {
    group: 'Main',
    links: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
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
    group: 'Business',
    links: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/business-profile', label: 'Business Profile', icon: Building },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div>
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">Coal Invoice</div>
          <div className="sidebar-logo-sub">Records Management</div>
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
          <div style={{ marginBottom: '1rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <div style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: '500' }}>
              {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
            </div>
            {user.email && user.email !== user.username && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{user.email}</div>
            )}
            {user.email === user.username && ![user.first_name, user.last_name].filter(Boolean).join(' ') && (
               <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Owner</div>
            )}
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
