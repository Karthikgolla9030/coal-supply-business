import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = location.state?.from?.pathname || '/';
  const successMessage = location.state?.message || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await login(cleanUsername, password);
      
      // Clear location state (like the success message) to prevent it from persisting on refresh if we navigated back to login later
      navigate(from, { replace: true, state: {} });
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Unable to connect to the server. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 'var(--space-4)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
            COAL INVOICE
          </h1>
          <p className="page-subtitle">
            Business Records Management
          </p>
        </div>

        {successMessage && !error && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
            ✓ {successMessage}
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <FormField
            label="Email"
            id="username"
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your email"
            required
          />
          
          <FormField
            label="Password"
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.25rem' }}>
            <Link 
              to="/forgot-password" 
              style={{ 
                color: 'var(--color-primary)', 
                fontSize: 'var(--font-size-sm)', 
                textDecoration: 'none',
                fontWeight: '500' 
              }}
            >
              Forgot Password?
            </Link>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="spinner" /> : 'Log In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: '500', textDecoration: 'none' }}>
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
