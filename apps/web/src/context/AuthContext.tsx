import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "../types";
import { authService } from "../services/auth.service";
import {
  clearAuthSession,
  persistAuthSession,
  loadAuthSession,
} from "../services/authSession";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const [user, setUser] = useState<User | null>(() => {
    const session = loadAuthSession();
    if (!session) {
      // Direct cleanup without invoking state mutator
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      return null;
    }
    return session.user;
  });

  const handleClearSession = () => {
    clearAuthSession();
    setUser(null);
  };

  useEffect(() => {
    const handleUnauthorized = () => handleClearSession();
    window.addEventListener("auth:session-cleared", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:session-cleared", handleUnauthorized);
    };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const { access_token, refresh_token, user: userData } = await authService.login(email, password);
      persistAuthSession(access_token, refresh_token, userData);
      setUser(userData);
      return userData;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const session = loadAuthSession();
      if (session) {
        await authService.logout();
      }
    } finally {
      handleClearSession();
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
