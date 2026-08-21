import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoice, downloadInvoicePdf, uploadToGoogleDrive } from '../api/invoices';
import InvoiceDocument from '../components/invoice/InvoiceDocument';
import RecordPaymentModal from '../components/ledger/RecordPaymentModal';
import { Download, CloudUpload, ArrowLeft, CheckCircle2, XCircle, ExternalLink, Calendar, Wallet } from 'lucide-react';
import { ledgerApi } from '../api/ledger';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = () => {
    getInvoice(id)
      .then((res) => {
        setInvoice(res.data);
        if (res.data.ledger_status) {
          fetchPayments(res.data.ledger_status.id);
        }
      })
      .catch((err) => {
        setError('Invoice not found or could not be loaded.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fetchPayments = async (ledgerEntryId) => {
    try {
      setLoadingPayments(true);
      const res = await ledgerApi.getLedgerPayments(ledgerEntryId);
      if (res.results) {
        setPayments(res.results);
      }
    } catch (err) {
      console.error("Failed to load payments for invoice");
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const response = await downloadInvoicePdf(id);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      let filename = `Invoice-${invoice.invoice_number}.pdf`;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Unable to generate the invoice PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleUploadDrive = async () => {
    try {
      setIsUploading(true);
      await uploadToGoogleDrive(id);
      // reload to get updated status
      loadInvoice();
    } catch (err) {
      alert('Google Drive upload failed. ' + (err.response?.data?.detail || ''));
      loadInvoice(); // reload to get FAILED status if applicable
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-state">
          <div className="spinner" style={{ margin: '0 auto var(--space-4)' }} />
          Loading invoice...
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="page-content">
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Action Bar */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {/* Google Drive Status & Actions */}
          {invoice.google_drive_status === 'UPLOADED' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-success)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
              <CheckCircle2 size={16} /> Stored in Google Drive
              {invoice.google_drive_file_url && (
                <a href={invoice.google_drive_file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ marginLeft: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Open <ExternalLink size={14} />
                </a>
              )}
            </div>
          ) : invoice.google_drive_status === 'FAILED' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <XCircle size={16} /> Google Drive upload failed
              </span>
              <button className="btn btn-secondary btn-sm" onClick={handleUploadDrive} disabled={isUploading}>
                {isUploading ? <><span className="spinner" /> Uploading…</> : <><CloudUpload size={14} /> Retry Upload</>}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={handleUploadDrive} disabled={isUploading} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {isUploading ? <><span className="spinner" /> Uploading…</> : <><CloudUpload size={14} /> Upload to Drive</>}
            </button>
          )}

          <button 
            className="btn btn-primary" 
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <><span className="spinner" /> Generating…</> : <><Download size={16} /> Download PDF</>}
          </button>
        </div>
      </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-4)', alignItems: 'start' }}>
        <div style={{ overflowX: 'auto' }}>
          <InvoiceDocument invoice={invoice} />
        </div>

        {invoice.ledger_status && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              PAYMENT STATUS
              <span style={{ 
                fontSize: '0.75rem', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '9999px',
                backgroundColor: invoice.ledger_status.status === 'PAID' ? 'var(--color-success)' : invoice.ledger_status.status === 'PARTIALLY_PAID' ? 'var(--color-warning)' : 'var(--color-danger)',
                color: 'white'
              }}>
                {invoice.ledger_status.status.replace('_', ' ')}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Invoice Total:</span>
                <span style={{ fontWeight: 600 }}>₹{parseFloat(invoice.ledger_status.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Paid:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>₹{parseFloat(invoice.ledger_status.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Remaining:</span>
                <span style={{ fontWeight: 600, fontSize: '1.25rem', color: invoice.ledger_status.remaining_amount > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                  ₹{parseFloat(invoice.ledger_status.remaining_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {invoice.ledger_status.remaining_amount > 0 && (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginBottom: '2rem' }}
                onClick={() => setIsPaymentModalOpen(true)}
              >
                Record Payment
              </button>
            )}

            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              PAYMENT HISTORY
            </h4>

            {loadingPayments ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading...</div>
            ) : payments.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem' }}>
                No payments recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {payments.map(payment => {
                  const dateObj = new Date(payment.payment_date);
                  const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                  return (
                    <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                          <Calendar size={12} />
                          <span>{dateStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                          <Wallet size={12} />
                          <span>{payment.payment_method.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-success)' }}>
                        ₹{parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {invoice.ledger_status && (
        <RecordPaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          ledgerEntry={{
            id: invoice.ledger_status.id,
            amount: invoice.ledger_status.amount,
            paid_amount: invoice.ledger_status.paid_amount,
            remaining_amount: invoice.ledger_status.remaining_amount
          }}
          onSuccess={() => {
            loadInvoice(); // Refresh invoice and payment data
          }}
        />
      )}
    </div>
  );
}
