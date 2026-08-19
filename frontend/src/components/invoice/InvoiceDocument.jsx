import React from 'react';
import './InvoiceDocument.css'; 

const formatCurrency = (amount) => {
  if (!amount) return '₹0.00';
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export default function InvoiceDocument({ invoice }) {
  if (!invoice) return null;

  const { business, customer, items } = invoice;

  return (
    <div className="invoice-document-wrapper">
      <div className="invoice-document">
        
        {/* Header - Business Info */}
        <header className="invoice-header">
          <h1 className="business-title">{business?.business_name || 'BUSINESS NAME'}</h1>
          <div className="business-details">
            {business?.address && <p>{business.address}</p>}
            <p>
              {business?.gstin && <span><strong>GSTIN:</strong> {business.gstin}</span>}
              {business?.phone && <span className="ms-3"><strong>Phone:</strong> {business.phone}</span>}
              {business?.email && <span className="ms-3"><strong>Email:</strong> {business.email}</span>}
            </p>
          </div>
        </header>

        {/* Invoice Title */}
        <div className="invoice-title-bar">
          <h2>TAX INVOICE</h2>
        </div>

        {/* Top Info Grid */}
        <div className="invoice-info-grid">
          <div className="invoice-info-box">
            <p><strong>Invoice No.:</strong> {invoice.invoice_number}</p>
            <p><strong>Date:</strong> {formatDate(invoice.invoice_date)}</p>
            <p><strong>Type:</strong> {invoice.transaction_type}</p>
          </div>
          <div className="invoice-info-box">
            <p><strong>Transport:</strong> {invoice.transport_name || '-'}</p>
            <p><strong>Vehicle No.:</strong> {invoice.vehicle_number || '-'}</p>
            <p><strong>Reverse Charge:</strong> {invoice.reverse_charge ? 'Yes' : 'No'}</p>
          </div>
        </div>

        {/* Receiver Section */}
        <div className="receiver-section">
          <h3>DETAILS OF RECEIVER / BILLED TO</h3>
          <p><strong>Name:</strong> {customer?.name}</p>
          {customer?.address && <p><strong>Address:</strong> {customer.address}</p>}
          <p>
            <span><strong>GSTIN:</strong> {customer?.gst_registered ? customer.gstin : 'Not Registered'}</span>
            {customer?.state && <span className="ms-3"><strong>State:</strong> {customer.state}</span>}
            {customer?.state_code && <span className="ms-3"><strong>State Code:</strong> {customer.state_code}</span>}
          </p>
        </div>

        {/* Items Table Wrapper for horizontal scroll on mobile */}
        <div className="invoice-table-wrapper">
          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>Sl</th>
                <th style={{ width: '35%' }}>Product</th>
                <th style={{ width: '10%' }}>HSN</th>
                <th style={{ width: '15%' }}>Qty</th>
                <th style={{ width: '15%' }}>Rate</th>
                <th style={{ width: '20%' }} className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items && items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.serial_number || index + 1}</td>
                    <td>{item.product_name}</td>
                    <td>{item.hsn_code}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>{item.rate}</td>
                    <td className="text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center">No items found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Area */}
        <div className="invoice-summary-area">
          <div className="summary-spacer"></div>
          <div className="summary-totals">
            <div className="summary-row">
              <span>Taxable Amount</span>
              <span>{formatCurrency(invoice.taxable_amount)}</span>
            </div>
            
            {/* CGST */}
            {parseFloat(invoice.cgst_amount) > 0 ? (
              <div className="summary-row">
                <span>CGST @ {invoice.cgst_rate}%</span>
                <span>{formatCurrency(invoice.cgst_amount)}</span>
              </div>
            ) : (
              <div className="summary-row" style={{ color: 'var(--color-text-muted)' }}>
                <span>CGST</span>
                <span>—</span>
              </div>
            )}
            
            {/* SGST */}
            {parseFloat(invoice.sgst_amount) > 0 ? (
              <div className="summary-row">
                <span>SGST @ {invoice.sgst_rate}%</span>
                <span>{formatCurrency(invoice.sgst_amount)}</span>
              </div>
            ) : (
              <div className="summary-row" style={{ color: 'var(--color-text-muted)' }}>
                <span>SGST</span>
                <span>—</span>
              </div>
            )}
            
            {/* IGST */}
            {parseFloat(invoice.igst_amount) > 0 ? (
              <div className="summary-row">
                <span>IGST @ {invoice.igst_rate}%</span>
                <span>{formatCurrency(invoice.igst_amount)}</span>
              </div>
            ) : (
              <div className="summary-row" style={{ color: 'var(--color-text-muted)' }}>
                <span>IGST</span>
                <span>—</span>
              </div>
            )}
            
            {parseFloat(invoice.tcs_amount) > 0 && (
              <div className="summary-row">
                <span>TCS @ {invoice.tcs_rate}%</span>
                <span>{formatCurrency(invoice.tcs_amount)}</span>
              </div>
            )}
            
            <div className="summary-row grand-total">
              <span>TOTAL</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="invoice-words">
          <strong>Amount in Words:</strong><br/>
          {invoice.amount_in_words}
        </div>

        {/* Footer Area */}
        <div className="invoice-footer-area">
          <div className="footer-left">
            {(business?.bank_name || business?.bank_account_number) && (
              <div className="bank-details">
                <h4>BANK DETAILS</h4>
                <p><strong>Bank:</strong> {business.bank_name}</p>
                <p><strong>Branch:</strong> {business.bank_branch}</p>
                <p><strong>Account No.:</strong> {business.bank_account_number}</p>
                <p><strong>IFSC:</strong> {business.bank_ifsc}</p>
              </div>
            )}
            
            {business?.terms_and_conditions && (
              <div className="terms-conditions mt-3">
                <h4>TERMS & CONDITIONS</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{business.terms_and_conditions}</p>
              </div>
            )}
          </div>
          
          <div className="footer-right signature-area">
            <p>For <strong>{business?.business_name}</strong></p>
            <div className="signature-space"></div>
            <p>Authorized Signatory</p>
          </div>
        </div>

      </div>
    </div>
  );
}
