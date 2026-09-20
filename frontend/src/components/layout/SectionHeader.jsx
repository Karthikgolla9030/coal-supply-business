import React from 'react';

export default function SectionHeader({ title, description, action }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 'var(--space-4)',
      gap: 'var(--space-4)'
    }}>
      <div>
        <h2 className="section-title" style={{ marginBottom: description ? 'var(--space-1)' : '0' }}>
          {title}
        </h2>
        {description && (
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
