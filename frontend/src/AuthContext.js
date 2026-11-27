import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

function normalize(data) {
  const u = data?.user ?? data;
  if (!u || typeof u !== 'object') return null;

  let dashboards = u.dashboards ?? [];
  if (typeof dashboards === 'string') {
    dashboards = dashboards.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(dashboards)) dashboards = [];
  dashboards = dashboards
    .map((d) => (typeof d === 'string' ? d : d?.name ?? d?.dashboard))
    .filter(Boolean);

  const role = String(u.role ?? '').toLowerCase();
  const isAdmin =
    role === 'admin' || u.is_admin === 1 || u.is_admin === true || u.is_admin === '1';

  return { ...u, dashboards, isAdmin };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api('/auth/me');
      setUser(normalize(r.data));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { username, password } });
    let merged = r.data;
    try {
      const me = await api('/auth/me');
      merged = { ...(r.data?.user ?? r.data), ...(me.data?.user ?? me.data) };
    } catch {
      // keep login data
    }
    setUser(normalize(merged));
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUser(null);
  };

  const can = (name) => !!user && (user.isAdmin || user.dashboards.includes(name));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);