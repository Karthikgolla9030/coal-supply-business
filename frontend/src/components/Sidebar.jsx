import { NavLink } from 'react-router-dom';

const navItems = [
  {
    group: 'Main',
    links: [
      { to: '/', label: 'Dashboard', icon: '⊞', end: true },
    ],
  },
  {
    group: 'Invoices',
    links: [
      { to: '/invoices', label: 'All Invoices', icon: '📋', end: true },
      { to: '/invoices/new', label: 'New Invoice', icon: '📄' },
    ],
  },
  {
    group: 'Business',
    links: [
      { to: '/customers', label: 'Customers', icon: '👥' },
      { to: '/business-profile', label: 'Business Profile', icon: '🏢' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">Coal Invoice</div>
        <div className="sidebar-logo-sub">Records Management</div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.group}>
            <div className="sidebar-section-label">{section.group}</div>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                <span style={{ fontSize: '1rem' }}>{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
