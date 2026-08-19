import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import FormField from '../components/FormField';
import { INDIAN_STATES, getStateCode } from '../utils/states';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    password_confirm: '',
    business_name: '',
    gstin: '',
    phone: '',
    business_email: '',
    address: '',
    state: '',
    state_code: ''
  });
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  // Using the context's internal methods directly to set tokens isn't exposed,
  // but we can just use window.location.href = '/' to trigger a full app reload
  // which will pick up the new tokens from localStorage and load the user context.

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'state') {
      const code = getStateCode(value);
      setFormData(prev => ({ ...prev, state: value, state_code: code }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      const response = await client.post('/auth/register/', formData);
      const { access, refresh } = response.data;
      
      // Store tokens for immediate login
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      // Redirect to dashboard, forcing an auth context reload
      window.location.href = '/';
      
    } catch (err) {
      console.error(err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Unable to create account. Please try again later.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 'var(--space-4)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
            COAL INVOICE
          </h1>
          <p className="page-subtitle">
            Create your business account
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          
          {/* Account Section */}
          <section className="form-section">
            <h2 className="section-title">
              OWNER CREDENTIALS
            </h2>
            <div className="form-grid">
              <FormField label="Full Name *" id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} required />
              <FormField label="Email *" id="email" type="email" name="email" value={formData.email} onChange={handleChange} required />
              <FormField label="Password *" id="password" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={8} />
              <FormField label="Confirm Password *" id="password_confirm" type="password" name="password_confirm" value={formData.password_confirm} onChange={handleChange} required minLength={8} />
            </div>
          </section>

          {/* Business Section */}
          <section>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
              BUSINESS INFORMATION
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <FormField label="Business Name *" id="business_name" name="business_name" value={formData.business_name} onChange={handleChange} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormField label="GSTIN" id="gstin" name="gstin" value={formData.gstin} onChange={handleChange} placeholder="Optional" />
                <FormField label="Phone" id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="Optional" />
              </div>
              <FormField label="Business Email" id="business_email" type="email" name="business_email" value={formData.business_email} onChange={handleChange} placeholder="Optional" />
              <FormField label="Address" id="address" name="address" value={formData.address} onChange={handleChange} placeholder="Optional" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-field">
                  <label htmlFor="state">State</label>
                  <select
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">-- Select State --</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <FormField label="State Code" id="state_code" name="state_code" value={formData.state_code} readOnly />
              </div>
            </div>
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <span className="spinner" /> : 'Create Business Account'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: '500', textDecoration: 'none' }}>
                  Login
                </Link>
              </p>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
