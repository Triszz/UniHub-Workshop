import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { StudentLayout } from "./components/student/StudentLayout";

// Pages
import { LoginPage } from "./pages/auth/LoginPage";
import { WorkshopListPage } from "./pages/student/WorkshopListPage";
import { WorkshopDetailPage } from "./pages/student/WorkshopDetailPage";
import { MyRegistrationsPage } from "./pages/student/MyRegistrationsPage";
import { CheckoutPage } from "./pages/student/CheckoutPage";
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
            element={
              <ProtectedRoute roles={["student"]}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/workshops" replace />} />
            <Route path="/workshops" element={<WorkshopListPage />} />
            <Route path="/workshops/:id" element={<WorkshopDetailPage />} />
            <Route path="/checkout/:id" element={<CheckoutPage />} />
            <Route path="/my-registrations" element={<MyRegistrationsPage />} />
          </Route>

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
