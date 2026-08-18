import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import BusinessProfile from './pages/BusinessProfile';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import InvoiceNew from './pages/InvoiceNew';
import InvoiceDetail from './pages/InvoiceDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/"                    element={<Dashboard />} />
            <Route path="/business-profile"    element={<BusinessProfile />} />
            <Route path="/customers"           element={<Customers />} />
            <Route path="/customers/:id"       element={<CustomerDetail />} />
            <Route path="/invoices"            element={<InvoiceList />} />
            <Route path="/invoices/new"        element={<InvoiceNew />} />
            <Route path="/invoices/:id"        element={<InvoiceDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
