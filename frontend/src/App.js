import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './theme.css';
import { AuthProvider } from './AuthContext';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Bank from './pages/Bank';
import Stationery from './pages/Stationery';
import Admin from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Home />} />
            <Route
              path="/bank"
              element={
                <RequireAuth dashboard="bank">
                  <Bank />
                </RequireAuth>
              }
            />
            <Route
              path="/stationery"
              element={
                <RequireAuth dashboard="stationery">
                  <Stationery />
                </RequireAuth>
              }
            />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}