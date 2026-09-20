import client from './client';

export const ledgerApi = {
  // Ledger Entries
  getLedgerEntries: async (filters = {}) => {
    // Construct query parameters
    const params = new URLSearchParams();
    if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.customer) params.append('customer', filters.customer);
    
    // Using string interpolation since client.get takes a string URL
    const queryString = params.toString();
    const url = `/ledger-entries/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url);
  },
  
  createLedgerEntry: async (data) => {
    return client.post('/ledger-entries/', data);
  },

  voidLedgerEntry: async (id) => {
    return client.post(`/ledger-entries/${id}/void/`);
  },

  getLedgerEntryAuditHistory: async (id) => {
    return client.get(`/ledger-entries/${id}/audit_history/`);
  },

  // Payments
  getLedgerPayments: async (ledgerEntryId) => {
    return client.get(`/ledger-payments/?ledger_entry=${ledgerEntryId}`);
  },

  createLedgerPayment: async (data) => {
    // If data is FormData (has file), let Axios set the correct Content-Type with boundary
    // by passing it directly. If it's a plain object, Axios sends JSON.
    if (data instanceof FormData) {
      return client.post('/ledger-payments/', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    }
    return client.post('/ledger-payments/', data);
  },

  voidLedgerPayment: async (id) => {
    return client.post(`/ledger-payments/${id}/void/`);
  },

  // Dashboard (Phase 5)
  getLedgerDashboard: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    
    const queryString = params.toString();
    const url = `/ledger/dashboard/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url);
  },

  // Transaction History (Phase 6)
  getTransactionHistory: async (filters = {}, page = 1) => {
    const params = new URLSearchParams();
    if (page > 1) params.append('page', page);
    if (filters.search) params.append('search', filters.search);
    if (filters.party_id) params.append('party_id', filters.party_id);
    if (filters.type_filter) params.append('type_filter', filters.type_filter);
    if (filters.status_filter) params.append('status_filter', filters.status_filter);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    
    const queryString = params.toString();
    const url = `/ledger/history/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url);
  },

  // Reports (Phase 7)
  getReports: async (filters = {}, page = 1) => {
    const params = new URLSearchParams();
    if (page > 1) params.append('page', page);
    if (filters.report_type) params.append('report_type', filters.report_type);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.party_id) params.append('party_id', filters.party_id);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    
    const queryString = params.toString();
    const url = `/reports/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url);
  },

  exportReportPdf: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.report_type) params.append('report_type', filters.report_type);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.party_id) params.append('party_id', filters.party_id);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    
    const queryString = params.toString();
    const url = `/reports/export/pdf/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url, { responseType: 'blob' });
  },

  exportReportExcel: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.report_type) params.append('report_type', filters.report_type);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.party_id) params.append('party_id', filters.party_id);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    
    const queryString = params.toString();
    const url = `/reports/export/excel/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url, { responseType: 'blob' });
  },

  exportReportCsv: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.report_type) params.append('report_type', filters.report_type);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.party_id) params.append('party_id', filters.party_id);
    if (filters.payment_method) params.append('payment_method', filters.payment_method);
    
    const queryString = params.toString();
    const url = `/reports/export/csv/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url, { responseType: 'blob' });
  }
};
