import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/common/ProtectedRoute";

// Pages
import { LoginPage } from "./pages/auth/LoginPage";
import { WorkshopListPage } from "./pages/student/WorkshopListPage";
import { WorkshopAdminPage } from "./pages/admin/WorkshopAdminPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Student routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute roles={["student"]}>
                <WorkshopListPage />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["organizer"]}>
                <Navigate to="/admin/workshops" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/workshops"
            element={
              <ProtectedRoute roles={["organizer"]}>
                <WorkshopAdminPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
