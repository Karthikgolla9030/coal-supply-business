import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MobileHeader({ onToggleMenu }) {
  const { user } = useAuth();

  return (
    <header className="mobile-header">
      <button 
        type="button" 
        className="mobile-menu-btn" 
        onClick={onToggleMenu}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      <div className="mobile-header-brand">
        <div className="mobile-header-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l9 4.9V17L12 22l-9-4.9V7z"/>
            <path d="M12 22V12"/>
            <path d="M12 12L3 7"/>
            <path d="M21 7l-9 5"/>
          </svg>
        </div>
        <div className="mobile-header-title">
          <span style={{ color: 'var(--color-primary)' }}>COAL</span> INVOICE
        </div>
      </div>

      <div className="mobile-header-user">
        {user ? (
          <div className="mobile-user-avatar" title={user.username || 'User'}>
            {user.first_name ? user.first_name[0].toUpperCase() : (user.username ? user.username[0].toUpperCase() : 'U')}
          </div>
        ) : (
          <div style={{ width: 32 }} />
        )}
      </div>
    </header>
  );
}
