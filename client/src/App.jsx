import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import { LogoMark } from './components/Logo';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Publications from './pages/Publications';
import CustomerBill from './pages/CustomerBill';
import MonthlyBills from './pages/MonthlyBills';
import YearlyReport from './pages/YearlyReport';
import Payments from './pages/Payments';
import Activity from './pages/Activity';

function Protected({ children }) {
  const { admin, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" role="status" aria-label="Loading">
        <div className="animate-pulse"><LogoMark className="h-14 w-14" /></div>
      </div>
    );
  }
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="publications" element={<Publications />} />
        <Route path="billing/customer" element={<CustomerBill />} />
        <Route path="billing/monthly" element={<MonthlyBills />} />
        <Route path="billing/yearly" element={<YearlyReport />} />
        <Route path="payments" element={<Payments />} />
        <Route path="activity" element={<Activity />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
