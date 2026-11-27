import { useState } from 'react';
import { Alert, Button, Col, Form, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api';
import AuthShell from '../components/AuthShell';

const empty = {
  full_name: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
};

export default function Register() {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mismatch = form.confirm_password !== '' && form.password !== form.confirm_password;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDetails([]);

    if (!/^[0-9+\-() ]{7,20}$/.test(form.phone.trim())) {
      setError('Enter a valid phone number (7-20 characters: digits, + - ( ) and spaces).');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const r = await api('/auth/register', {
        method: 'POST',
        body: {
          full_name: form.full_name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          confirm_password: form.confirm_password,
        },
      });
      setDone(r.message);
      setForm(empty);
    } catch (err) {
      setError(err.message);
      const p = err.payload;
      const src = p?.errors ?? p?.data;
      if (src && typeof src === 'object') {
        setDetails(Object.values(src).filter((v) => typeof v === 'string'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create an account"
      subtitle="Register, then wait for the administrator to approve your account."
    >
      {done ? (
        <>
          <Alert variant="success">{done}</Alert>
          <Link to="/login">Back to sign in</Link>
        </>
      ) : (
        <>
          {error && (
            <Alert variant="danger">
              {error}
              {details.length > 0 && (
                <ul className="mb-0 mt-2">
                  {details.map((d) => <li key={d}>{d}</li>)}
                </ul>
              )}
            </Alert>
          )}
          <Form onSubmit={submit}>
            <Form.Group className="mb-3">
              <Form.Label>Full name</Form.Label>
              <Form.Control value={form.full_name} onChange={set('full_name')} maxLength={100} required />
            </Form.Group>
            <Row className="g-3 mb-3">
              <Col sm={6}>
                <Form.Label>Username</Form.Label>
                <Form.Control value={form.username} onChange={set('username')} maxLength={50} required />
              </Col>
              <Col sm={6}>
                <Form.Label>Phone number</Form.Label>
                <Form.Control value={form.phone} onChange={set('phone')} maxLength={20} required />
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={form.email} onChange={set('email')} required />
            </Form.Group>
            <Row className="g-3 mb-2">
              <Col sm={6}>
                <Form.Label>Password</Form.Label>
                <Form.Control type="password" value={form.password} onChange={set('password')} minLength={8} required />
              </Col>
              <Col sm={6}>
                <Form.Label>Confirm password</Form.Label>
                <Form.Control
                  type="password"
                  value={form.confirm_password}
                  onChange={set('confirm_password')}
                  isInvalid={mismatch}
                  isValid={form.confirm_password !== '' && !mismatch}
                  required
                />
                <Form.Control.Feedback type="invalid">Passwords do not match.</Form.Control.Feedback>
              </Col>
            </Row>
            <Form.Text className="text-muted d-block mb-3">
              Username: letters, numbers, underscore or dot (3-50 characters). Password: at least 8 characters.
            </Form.Text>
            <Button type="submit" size="lg" className="w-100" disabled={busy}>
              {busy ? 'Sending...' : 'Register'}
            </Button>
          </Form>
          <div className="mt-4 text-center">
            Already registered? <Link to="/login">Sign in</Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}