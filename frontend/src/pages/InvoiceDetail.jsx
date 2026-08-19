import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoice, downloadInvoicePdf, uploadToGoogleDrive } from '../api/invoices';
import InvoiceDocument from '../components/invoice/InvoiceDocument';
import { Download, CloudUpload, ArrowLeft, CheckCircle2, XCircle, CloudRain, ExternalLink } from 'lucide-react';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = () => {
    getInvoice(id)
      .then((res) => {
        setInvoice(res.data);
      })
      .catch((err) => {
        setError('Invoice not found or could not be loaded.');
      })
      .finally(() => {
        setLoading(false);
      });
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

      <InvoiceDocument invoice={invoice} />
    </div>
  );
}
