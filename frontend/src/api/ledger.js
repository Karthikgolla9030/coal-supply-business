import client from './client';

export const ledgerApi = {
  // Ledger Entries
  getLedgerEntries: async (filters = {}) => {
    // Construct query parameters
    const params = new URLSearchParams();
    if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    
    // Using string interpolation since client.get takes a string URL
    const queryString = params.toString();
    const url = `/ledger-entries/${queryString ? `?${queryString}` : ''}`;
    
    return client.get(url);
  },
  
  createLedgerEntry: async (data) => {
    return client.post('/ledger-entries/', data);
  },

  // Payments
  getLedgerPayments: async (ledgerEntryId) => {
    return client.get(`/ledger-payments/?ledger_entry=${ledgerEntryId}`);
  },

  createLedgerPayment: async (data) => {
    return client.post('/ledger-payments/', data);
  }
};
