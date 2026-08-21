import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import BusinessProfile from './pages/BusinessProfile';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import InvoiceNew from './pages/InvoiceNew';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoiceList from './pages/InvoiceList';
import Login from './pages/Login';
import Register from './pages/Register';
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/business-profile" element={<ProtectedRoute><AppLayout><BusinessProfile /></AppLayout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><AppLayout><CustomerDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><AppLayout><InvoiceList /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><AppLayout><InvoiceNew /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute><AppLayout><InvoiceDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/ledger" element={<ProtectedRoute><AppLayout><Ledger /></AppLayout></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
