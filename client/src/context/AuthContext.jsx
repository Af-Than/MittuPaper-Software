import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session (httpOnly cookie) on first load
  useEffect(() => {
    api.me().then((r) => setAdmin(r.admin)).catch(() => setAdmin(null)).finally(() => setLoading(false));
  }, []);

  // Any API call that comes back 401 while signed in means the session expired
  useEffect(() => {
    const onExpired = () => {
      setAdmin((current) => {
        if (current) toast.error('Your session has expired. Please sign in again.');
        return null;
      });
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [toast]);

  const login = useCallback(async (username, password) => {
    const r = await api.login({ username, password });
    setAdmin(r.admin);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { setAdmin(null); }
  }, []);

  const value = useMemo(() => ({ admin, loading, login, logout }), [admin, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
