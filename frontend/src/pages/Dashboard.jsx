export default function Dashboard() {
  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Coal Invoice &amp; Records Management System</p>
      </div>

      <div className="card">
        <div
          style={{
            padding: 'var(--space-10)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)', opacity: 0.3 }}>
            📄
          </div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
            Invoice management coming soon
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            Set up your Business Profile and add Customers to get started.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Quick Links</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <a href="/business-profile" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
              → Configure Business Profile
            </a>
            <a href="/customers" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
              → Manage Customers
            </a>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Phase Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
            <div style={{ color: 'var(--color-success)' }}>✓ Phase 1 — Project foundation</div>
            <div style={{ color: 'var(--color-success)' }}>✓ Phase 2 — PostgreSQL connected</div>
            <div style={{ color: 'var(--color-success)' }}>✓ Phase 3 — Database models</div>
            <div style={{ color: 'var(--color-success)' }}>✓ Phase 4 — Business Profile &amp; Customers</div>
            <div style={{ color: 'var(--color-text-muted)' }}>○ Phase 5 — Invoice creation</div>
          </div>
        </div>
      </div>
    </div>
  );
}
