import React from 'react';

export default function FilterBar({ children, className = '', style = {} }) {
  return (
    <div className={`toolbar ${className}`} style={style}>
      {children}
    </div>
  );
}
