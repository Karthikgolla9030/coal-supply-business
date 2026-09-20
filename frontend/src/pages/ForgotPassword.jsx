import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../components/FormField';
import { requestPasswordReset } from '../api/auth';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await requestPasswordReset(cleanEmail);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Unable to process your request. Please try again later.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 'var(--space-4)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
            RESET PASSWORD
          </h1>
          <p className="page-subtitle">
            Enter your registered email to receive a password reset link.
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        {submitted ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '52px', 
              height: '52px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary-soft)', 
              color: 'var(--color-primary)', 
              marginBottom: 'var(--space-4)' 
            }}>
              <CheckCircle2 size={30} />
            </div>

            <div className="alert alert-success" style={{ textAlign: 'left', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
              If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}>
              The reset link will expire in 1 hour.
            </p>

            <Link 
              to="/login" 
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', textDecoration: 'none' }}
            >
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <FormField
              label="Email Address"
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@example.com"
              required
              autoFocus
            />

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="spinner" />
              ) : (
                <>
                  <Mail size={16} /> Send Reset Link
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
              <Link 
                to="/login" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  color: 'var(--color-text-muted)', 
                  fontSize: 'var(--font-size-sm)', 
                  textDecoration: 'none' 
                }}
              >
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
