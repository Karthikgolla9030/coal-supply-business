import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import BusinessProfile from './pages/BusinessProfile';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import Purchases from './pages/Purchases';
import PurchaseDetail from './pages/PurchaseDetail';
import Sales from './pages/Sales';
import SaleDetail from './pages/SaleDetail';
import Stock from './pages/Stock';
import Expenses from './pages/Expenses';
import ExpenseDetail from './pages/ExpenseDetail';
import ProfitLoss from './pages/ProfitLoss';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import InvoiceNew from './pages/InvoiceNew';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoiceList from './pages/InvoiceList';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Ledger from './pages/Ledger';

// Layout wrapper for protected pages that need the sidebar
function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}

import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/business-profile" element={<ProtectedRoute><AppLayout><BusinessProfile /></AppLayout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><AppLayout><CustomerDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
          <Route path="/suppliers/:id" element={<ProtectedRoute><AppLayout><SupplierDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute><AppLayout><Purchases /></AppLayout></ProtectedRoute>} />
          <Route path="/purchases/:id" element={<ProtectedRoute><AppLayout><PurchaseDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><AppLayout><Sales /></AppLayout></ProtectedRoute>} />
          <Route path="/sales/:id" element={<ProtectedRoute><AppLayout><SaleDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/stock" element={<ProtectedRoute><AppLayout><Stock /></AppLayout></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><AppLayout><Expenses /></AppLayout></ProtectedRoute>} />
          <Route path="/expenses/:id" element={<ProtectedRoute><AppLayout><ExpenseDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/profit-loss" element={<ProtectedRoute><AppLayout><ProfitLoss /></AppLayout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
          <Route path="/reports/:type" element={<ProtectedRoute><AppLayout><ReportDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><AppLayout><InvoiceList /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><AppLayout><InvoiceNew /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute><AppLayout><InvoiceDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/ledger" element={<ProtectedRoute><AppLayout><Ledger /></AppLayout></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
