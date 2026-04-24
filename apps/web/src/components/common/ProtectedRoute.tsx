import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomePathByRole, isWebSupportedRole } from "../../services/authSession";

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

export const ProtectedRoute: React.FC<Props> = ({ children, roles }) => {
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (user && !isWebSupportedRole(user.role)) {
      logout();
    }
  }, [user, logout]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  if (!isWebSupportedRole(user.role)) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const fallbackRoute = getHomePathByRole(user.role) || "/login";
    return <Navigate to={fallbackRoute} replace />;
  }

  return <>{children}</>;
};
