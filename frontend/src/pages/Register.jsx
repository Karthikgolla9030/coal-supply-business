import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import FormField from '../components/FormField';
import { Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      
      await client.post('/auth/register/', formData);
      
      // Navigate to login with success message in state
      navigate('/login', { 
        state: { 
          message: 'Account created successfully. Please log in to continue.' 
        } 
      });
      
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
      <div className="card" style={{ width: '100%', maxWidth: '500px', padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
            COAL INVOICE
          </h1>
          <p className="page-subtitle">
            Create your account
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <FormField 
              label="Name" 
              id="full_name" 
              name="full_name" 
              value={formData.full_name} 
              onChange={handleChange} 
              required 
            />
            
            <FormField 
              label="Email" 
              id="email" 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
            />
            
            <FormField 
              label="Password" 
              id="password" 
              type={showPassword ? "text" : "password"} 
              name="password" 
              value={formData.password} 
              onChange={handleChange} 
              required 
              minLength={8} 
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
            
            <FormField 
              label="Confirm Password" 
              id="password_confirm" 
              type={showConfirmPassword ? "text" : "password"} 
              name="password_confirm" 
              value={formData.password_confirm} 
              onChange={handleChange} 
              required 
              minLength={8} 
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <span className="spinner" /> : 'Create Account'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: '500', textDecoration: 'none' }}>
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
