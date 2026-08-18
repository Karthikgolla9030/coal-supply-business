import { useState, useEffect } from 'react';
import FormField from '../components/FormField';
import { getBusinessProfile, saveBusinessProfile } from '../api/businessProfile';

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
          {alert.type === 'success' ? '✓' : '✕'} {alert.message}
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
            <FormField
              label="State"
              name="state"
              id="state"
              value={form.state}
              onChange={handleChange}
              error={errors.state}
              placeholder="e.g. Karnataka"
            />
            <FormField
              label="State Code"
              name="state_code"
              id="state_code"
              value={form.state_code}
              onChange={handleChange}
              error={errors.state_code}
              placeholder="e.g. 29"
              maxLength={10}
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
              <>💾 Save Changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
