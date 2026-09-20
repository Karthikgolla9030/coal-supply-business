import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import FormField from '../components/FormField';
import { validateResetToken, confirmPasswordReset } from '../api/auth';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowLeft, KeyRound } from 'lucide-react';

export default function ResetPassword() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [tokenError, setTokenError] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Pre-validate the token on page load
  useEffect(() => {
    let isMounted = true;

    async function verifyToken() {
      if (!uid || !token) {
        if (isMounted) {
          setIsTokenValid(false);
          setTokenError('The password reset link is malformed or missing parameters.');
          setIsValidating(false);
        }
        return;
      }

      try {
        const response = await validateResetToken(uid, token);
        if (isMounted) {
          setIsTokenValid(true);
          setUserEmail(response.data?.email || '');
          setIsValidating(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsTokenValid(false);
          setTokenError(
            err.response?.data?.detail || 'This password reset link is invalid or has expired.'
          );
          setIsValidating(false);
        }
      }
    }

    verifyToken();
    return () => { isMounted = false; };
  }, [uid, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || !passwordConfirm) {
      setError('Please fill in both password fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await confirmPasswordReset({
        uid,
        token,
        password,
        password_confirm: passwordConfirm,
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Unable to reset password. The link may have expired or is invalid.');
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
            NEW PASSWORD
          </h1>
          <p className="page-subtitle">
            Create a strong, secure password for your account.
          </p>
        </div>

        {/* 1. Loading State */}
        {isValidating && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <span className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Verifying reset link…
            </p>
          </div>
        )}

        {/* 2. Invalid or Expired Token State */}
        {!isValidating && !isTokenValid && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '52px', 
              height: '52px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-danger-soft)', 
              color: 'var(--color-danger)', 
              marginBottom: 'var(--space-4)' 
            }}>
              <AlertTriangle size={28} />
            </div>

            <div className="alert alert-error" style={{ marginBottom: 'var(--space-5)', textAlign: 'left', lineHeight: 1.5 }}>
              {tokenError || 'This password reset link is invalid or has expired.'}
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}>
              Reset links expire after 1 hour or immediately once used. Please request a new link.
            </p>

            <Link 
              to="/forgot-password" 
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', textDecoration: 'none' }}
            >
              Request a New Link
            </Link>
          </div>
        )}

        {/* 3. Successful Password Reset State */}
        {!isValidating && isTokenValid && success && (
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

            <div className="alert alert-success" style={{ marginBottom: 'var(--space-5)', textAlign: 'left' }}>
              ✓ Your password has been reset successfully.
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}>
              You can now sign in with your new credentials.
            </p>

            <Link 
              to="/login" 
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', textDecoration: 'none' }}
            >
              <ArrowLeft size={16} /> Proceed to Login
            </Link>
          </div>
        )}

        {/* 4. Active Reset Password Form */}
        {!isValidating && isTokenValid && !success && (
          <>
            {userEmail && (
              <div style={{ 
                backgroundColor: 'var(--color-bg-subtle)', 
                border: '1px solid var(--color-border)', 
                borderRadius: '6px', 
                padding: '0.65rem 0.85rem', 
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)'
              }}>
                Account: <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{userEmail}</span>
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <FormField
                label="New Password"
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                autoFocus
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
                label="Confirm New Password"
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                required
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
                    <KeyRound size={16} /> Reset Password
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
          </>
        )}
      </div>
    </div>
  );
}
