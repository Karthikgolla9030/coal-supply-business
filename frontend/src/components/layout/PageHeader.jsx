import React from 'react';

export default function PageHeader({ title, description, action }) {
  return (
    <div className="page-header">
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
