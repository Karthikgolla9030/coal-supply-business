import { useState, useEffect } from 'react';
import FormField from '../components/FormField';
import { getBusinessProfile, saveBusinessProfile } from '../api/businessProfile';
import { INDIAN_STATES, getStateCode } from '../utils/states';
import { CheckCircle, AlertCircle, Save, Cloud } from 'lucide-react';

const INITIAL_FORM = {
  business_name: '',
  gstin: '',
  phone: '',
  email: '',
  address: '',
  state: '',
  state_code: '',
  bank_name: '',
  bank_branch: '',
  bank_account_number: '',
  bank_ifsc: '',
  terms_and_conditions: '',
};

function extractErrors(responseData) {
  if (!responseData || typeof responseData !== 'object') return {};
  const errors = {};
  for (const [key, val] of Object.entries(responseData)) {
    errors[key] = Array.isArray(val) ? val[0] : val;
  }
  return errors;
}

export default function BusinessProfilePage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success'|'error', message }

  // ── Load existing profile on mount ──────────────────────────
  useEffect(() => {
    getBusinessProfile()
      .then((res) => {
        const data = res.data;
        setForm({
          business_name:       data.business_name        ?? '',
          gstin:               data.gstin                ?? '',
          phone:               data.phone                ?? '',
          email:               data.email                ?? '',
          address:             data.address              ?? '',
          state:               data.state                ?? '',
          state_code:          data.state_code           ?? '',
          bank_name:           data.bank_name            ?? '',
          bank_branch:         data.bank_branch          ?? '',
          bank_account_number: data.bank_account_number  ?? '',
          bank_ifsc:           data.bank_ifsc            ?? '',
          terms_and_conditions:data.terms_and_conditions ?? '',
        });
        setProfileExists(true);
      })
      .catch((err) => {
        // 404 means no profile yet — that's fine
        if (err.response?.status !== 404) {
          setAlert({ type: 'error', message: 'Failed to load business profile.' });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Load Google Drive Status ────────────────────────────────
  const [driveConnected, setDriveConnected] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(true);

  useEffect(() => {
    // Check URL parameters for OAuth callbacks
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive') === 'connected') {
      setAlert({ type: 'success', message: 'Google Drive connected successfully!' });
      // Remove query param without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('drive') === 'error') {
      setAlert({ type: 'error', message: 'Google Drive connection failed. Please try again.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    import('../api/client').then(({ default: client }) => {
      client.get('/google-drive/status/')
        .then(res => setDriveConnected(res.data.connected))
        .catch(err => console.error("Drive status check failed", err))
        .finally(() => setCheckingDrive(false));
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'state') {
      const code = getStateCode(value);
      setForm((prev) => ({ ...prev, state: value, state_code: code }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    // Clear individual field error when user types
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setAlert(null);
    setSaving(true);

    try {
      await saveBusinessProfile(form, profileExists);
      setProfileExists(true);
      setAlert({ type: 'success', message: 'Business profile saved successfully.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data) {
        setErrors(extractErrors(data));
        setAlert({ type: 'error', message: 'Please fix the errors below.' });
      } else {
        setAlert({ type: 'error', message: data?.detail || 'Failed to save. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-state">
          <div className="spinner" style={{ margin: '0 auto var(--space-4)' }} />
          Loading business profile…
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Business Profile</h1>
        <p className="page-subtitle">
          This information appears on every invoice you generate.
        </p>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Business Information ─────────────────────────── */}
        <div className="card">
          <div className="card-title">Business Information</div>
          <div className="form-grid">
            <FormField
              label="Business Name"
              name="business_name"
              id="business_name"
              required
              value={form.business_name}
              onChange={handleChange}
              error={errors.business_name}
              placeholder="e.g. Sunrise Coal Traders"
            />
            <FormField
              label="GSTIN"
              name="gstin"
              id="gstin"
              value={form.gstin}
              onChange={handleChange}
              error={errors.gstin}
              placeholder="e.g. 29ABCDE1234F1Z5"
              help="15-character GST Identification Number"
              maxLength={15}
            />
            <FormField
              label="Phone"
              name="phone"
              id="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              error={errors.phone}
              placeholder="e.g. 9876543210"
            />
            <FormField
              label="Email"
              name="email"
              id="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="e.g. info@yourbusiness.com"
            />
            <FormField
              label="Address"
              name="address"
              id="address"
              as="textarea"
              value={form.address}
              onChange={handleChange}
              error={errors.address}
              placeholder="Full business address"
              className="form-field span-2"
            />
            <div className="form-field">
              <label htmlFor="state">State</label>
              <select
                id="state"
                name="state"
                value={form.state}
                onChange={handleChange}
                className={errors.state ? 'error' : ''}
              >
                <option value="">-- Select State --</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.state && <div className="error-msg">{errors.state}</div>}
            </div>
            <FormField
              label="State Code"
              name="state_code"
              id="state_code"
              value={form.state_code}
              readOnly
              help="Derived automatically"
            />
          </div>
        </div>

        {/* ── Bank Details ─────────────────────────────────── */}
        <div className="card">
          <div className="card-title">Bank Details</div>
          <div className="form-grid">
            <FormField
              label="Bank Name"
              name="bank_name"
              id="bank_name"
              value={form.bank_name}
              onChange={handleChange}
              error={errors.bank_name}
              placeholder="e.g. State Bank of India"
            />
            <FormField
              label="Branch"
              name="bank_branch"
              id="bank_branch"
              value={form.bank_branch}
              onChange={handleChange}
              error={errors.bank_branch}
              placeholder="e.g. MG Road, Bangalore"
            />
            <FormField
              label="Account Number"
              name="bank_account_number"
              id="bank_account_number"
              value={form.bank_account_number}
              onChange={handleChange}
              error={errors.bank_account_number}
              placeholder="e.g. 12345678901"
            />
            <FormField
              label="IFSC Code"
              name="bank_ifsc"
              id="bank_ifsc"
              value={form.bank_ifsc}
              onChange={handleChange}
              error={errors.bank_ifsc}
              placeholder="e.g. SBIN0001234"
              help="11-character IFSC code"
              maxLength={11}
            />
          </div>
        </div>

        {/* ── Invoice Settings ─────────────────────────────── */}
        <div className="card">
          <div className="card-title">Invoice Settings</div>
          <div className="form-grid single">
            <FormField
              label="Terms &amp; Conditions"
              name="terms_and_conditions"
              id="terms_and_conditions"
              as="textarea"
              value={form.terms_and_conditions}
              onChange={handleChange}
              error={errors.terms_and_conditions}
              placeholder="Enter the terms and conditions that appear on your invoices…"
              style={{ minHeight: '120px' }}
            />
          </div>
        </div>

        {/* ── Google Drive Integration ───────────────────────── */}
        <div className="card premium-card glass-panel animate-slide-up" style={{ marginTop: 'var(--space-6)', border: '1px solid var(--color-primary-soft)' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud className="glow-icon" style={{ color: 'var(--color-primary)' }} size={24} /> 
            <span>Google Drive Integration</span>
          </div>
          <div style={{ padding: 'var(--space-4) 0 var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {checkingDrive ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                <span className="spinner"></span> Checking Drive status...
              </div>
            ) : driveConnected ? (
              <div style={{ background: 'var(--color-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
                  <CheckCircle size={22} className="glow-icon" />
                  <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>Connected & Active</span>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: 'var(--space-4)', lineHeight: '1.5' }}>
                  Your Google Drive is successfully linked. Invoice PDFs generated by this business profile will be automatically saved to your securely encrypted "Coal Invoices" folder.
                </p>
                <button 
                  type="button"
                  onClick={async () => {
                    import('../api/client').then(({ default: client }) => {
                      client.get('/google-drive/oauth/start/')
                        .then(res => { window.location.href = res.data.url; })
                        .catch(err => setAlert({ type: 'error', message: 'Failed to start Google Drive connection.' }));
                    });
                  }}
                  className="btn" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-bg)' }}
                >
                  <Cloud size={16} /> Connect a Different Account
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--color-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <p style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: '500', marginBottom: 'var(--space-2)' }}>
                  Securely Backup Your Invoices
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: 'var(--space-4)', lineHeight: '1.5' }}>
                  Connect your Google Drive to automatically organize and save your invoice PDFs in a dedicated folder. You retain complete ownership of your data.
                </p>
                <button 
                  type="button"
                  onClick={async () => {
                    import('../api/client').then(({ default: client }) => {
                      client.get('/google-drive/oauth/start/')
                        .then(res => { window.location.href = res.data.url; })
                        .catch(err => setAlert({ type: 'error', message: 'Failed to start Google Drive connection.' }));
                    });
                  }}
                  className="btn btn-primary" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem', boxShadow: '0 4px 12px var(--color-primary-soft)' }}
                >
                  <Cloud size={20} /> Connect Google Drive
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Submit ───────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={saving}
            id="save-business-profile-btn"
          >
            {saving ? (
              <><span className="spinner" /> Saving…</>
            ) : (
              <><Save size={18} /> Save Changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
