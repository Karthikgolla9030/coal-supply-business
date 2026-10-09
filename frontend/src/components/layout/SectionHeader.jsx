import React from 'react';

export default function SectionHeader({ title, description, action }) {
  return (
    <div className="section-header">
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
      {action && <div className="section-header-action">{action}</div>}
    </div>
  );
}
