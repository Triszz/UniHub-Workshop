import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { api, saveTokens, clearTokens, TOKEN_KEY } from "../services/api";

type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (access_token: string, refresh_token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage / secure store for existing session
    const loadSession = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          // If we had a /auth/me endpoint we would call it here.
          // For now, if we have a token, we might not have the user details unless we saved them
          // Let's assume we fetch user info if there's a token, but since we don't have that in spec yet,
          // we'll just check if there's a user string in SecureStore (if we decide to save it).
          const userStr = await SecureStore.getItemAsync("user_data");
          if (userStr) {
            setUser(JSON.parse(userStr));
          }
        }
      } catch (e) {
        console.error("Failed to load session", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (access_token: string, refresh_token: string, userData: User) => {
    await saveTokens(access_token, refresh_token);
    await SecureStore.setItemAsync("user_data", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Ignore error if logout fails
    }
    await clearTokens();
    await SecureStore.deleteItemAsync("user_data");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
