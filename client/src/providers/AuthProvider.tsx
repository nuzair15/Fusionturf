import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const autoLogin = async () => {
      try {
        if (api.isAuthenticated()) {
          const me = await api.getMe();
          setUser(me);
        }
      } catch {
        api.logout();
      } finally {
        setIsLoading(false);
      }
    };
    autoLogin();

    // api.ts dispatches this when a request comes back 401 for a token we
    // thought was valid (expired, revoked, or the user was deactivated) —
    // it already clears the stored token, this just clears the in-memory
    // user so the UI reflects "logged out" immediately instead of a stale
    // authenticated view until the next full page load.
    const onAuthExpired = () => setUser(null);
    window.addEventListener("fusion-auth-expired", onAuthExpired);
    return () => window.removeEventListener("fusion-auth-expired", onAuthExpired);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
  };

  const register = async (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) => {
    const res = await api.register(data);
    setUser(res.user);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
