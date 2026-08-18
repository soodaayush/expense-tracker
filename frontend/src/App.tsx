import { Navigate, Route, Routes } from "react-router-dom";
import SlowRequestBanner from "./components/SlowRequestBanner";
import { useIdleLogout } from "./hooks/useIdleLogout";
import { useSession } from "./hooks/useSession";
import BillsPage from "./routes/BillsPage";
import ImportPage from "./routes/ImportPage";
import LoginPage from "./routes/LoginPage";
import ManagePayeesPage from "./routes/ManagePayeesPage";
import ManagePaymentMethodsPage from "./routes/ManagePaymentMethodsPage";
import NotificationsPage from "./routes/NotificationsPage";
import ReportsPage from "./routes/ReportsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated, isLoading } = useSession();
  useIdleLogout(authenticated);

  if (isLoading) return <div className="page-loading">Loading…</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <SlowRequestBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <BillsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute>
              <ImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payees"
          element={
            <ProtectedRoute>
              <ManagePayeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-methods"
          element={
            <ProtectedRoute>
              <ManagePaymentMethodsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
