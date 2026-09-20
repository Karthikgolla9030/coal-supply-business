import React from 'react';

export default function FilterBar({ children }) {
  return (
    <div className="toolbar" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      flexWrap: 'wrap',
      marginBottom: 'var(--space-5)'
    }}>
      {children}
    </div>
  );
}
