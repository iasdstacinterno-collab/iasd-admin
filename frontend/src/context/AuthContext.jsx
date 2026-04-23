import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from Google OAuth callback, skip /me - AuthCallback handles it
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const loginWithPassword = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("cf_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const registerWithPassword = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("cf_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("cf_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithPassword, registerWithPassword, logout, setUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
