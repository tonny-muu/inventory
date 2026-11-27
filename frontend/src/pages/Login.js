import { useState } from 'react';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AuthShell from '../components/AuthShell';

const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </Icon>
);

const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Icon>
);

const EyeIcon = ({ off }) => (
  <Icon>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </Icon>
);

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your username and password to continue.">
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <Form onSubmit={submit}>
        <Form.Group className="mb-3" controlId="login-username">
          <Form.Label className="fw-semibold">Username</Form.Label>
          <InputGroup size="lg" className="cr-input-group">
            <InputGroup.Text><UserIcon /></InputGroup.Text>
            <Form.Control
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-4" controlId="login-password">
          <Form.Label className="fw-semibold">Password</Form.Label>
          <InputGroup size="lg" className="cr-input-group">
            <InputGroup.Text><LockIcon /></InputGroup.Text>
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="button"
              className="cr-eye"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((s) => !s)}
            >
              <EyeIcon off={showPassword} />
            </Button>
          </InputGroup>
        </Form.Group>

        <Button type="submit" size="lg" className="w-100 cr-login-btn" disabled={busy}>
          {busy && <Spinner size="sm" className="me-2" />}
          {busy ? 'Signing in...' : 'Sign in'}
        </Button>
      </Form>

      <div className="cr-login-foot">
        New here? <Link to="/register">Create an account</Link>
      </div>
    </AuthShell>
  );
}