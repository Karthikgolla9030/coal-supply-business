import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoice, downloadInvoicePdf, uploadToGoogleDrive } from '../api/invoices';
import InvoiceDocument from '../components/invoice/InvoiceDocument';

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
      <div className="page-content" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p>Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="page-content" style={{ textAlign: 'center', color: 'red', marginTop: '2rem' }}>
        <h4>Error</h4>
        <p>{error}</p>
        <button className="btn btn-secondary mt-3" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem 1rem', minHeight: '100vh', backgroundColor: '#e2e8f0' }}>
      {/* Action Bar */}
      <div style={{ maxWidth: '800px', margin: '0 auto 1.5rem auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate(-1)}
        >
          &larr; Back
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Google Drive Status & Actions */}
          {invoice.google_drive_status === 'UPLOADED' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#c6f6d5', color: '#22543d', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem' }}>
              <span>✓ Stored in Google Drive</span>
              {invoice.google_drive_file_url && (
                <a href={invoice.google_drive_file_url} target="_blank" rel="noreferrer" style={{ color: '#2b6cb0', textDecoration: 'underline', fontWeight: 'bold' }}>
                  Open in Google Drive
                </a>
              )}
            </div>
          ) : invoice.google_drive_status === 'FAILED' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fed7d7', color: '#742a2a', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem' }}>
              <span>✗ Google Drive upload failed</span>
              <button className="btn btn-secondary btn-sm" onClick={handleUploadDrive} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Retry Upload'}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={handleUploadDrive} disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload to Google Drive'}
            </button>
          )}

          <button 
            className="btn btn-secondary" 
            disabled 
            title="Editing will be implemented in a later phase"
          >
            Edit Invoice
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <InvoiceDocument invoice={invoice} />
    </div>
  );
}
