import React from 'react';

export default function PageHeader({ title, description, action, className = '', style = {} }) {
  return (
    <div className={`page-header ${className}`} style={style}>
      <div className="page-header-content">
        <h1 className="page-title">{title}</h1>
        {description && <div className="page-subtitle">{description}</div>}
      </div>
      {action && (
        <div className="page-header-action">
          {action}
        </div>
      )}
    </div>
  );
}
