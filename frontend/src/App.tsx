import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import BillsPage from "./routes/BillsPage";
import ImportPage from "./routes/ImportPage";
import LoginPage from "./routes/LoginPage";
import ManagePayeesPage from "./routes/ManagePayeesPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated, isLoading } = useSession();

  if (isLoading) return <div className="page-loading">Loading…</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
