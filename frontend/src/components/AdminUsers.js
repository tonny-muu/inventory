import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { api } from '../api';
import { dateTimeOf } from '../utils';

const DASHBOARDS = [
  { key: 'stationery', label: 'Stationery' },
  { key: 'bank', label: 'Bank' },
];

const STATUSES = ['pending', 'approved', 'rejected', 'disabled', 'all'];
const badge = { pending: 'warning', approved: 'success', rejected: 'secondary', disabled: 'danger' };

export default function AdminUsers() {
  const [status, setStatus] = useState('pending');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [modal, setModal] = useState(null); // { user, mode: 'approve' | 'dashboards' }
  const [picked, setPicked] = useState([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = status === 'all' ? '' : `?status=${status}`;
      const r = await api('/admin/users' + q);
      setUsers(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (u, action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      const r = await api(`/admin/users/${u.id}/${action}`, { method: 'POST' });
      setNotice(r.message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openModal = (u, mode) => {
    setModal({ user: u, mode });
    setPicked(u.dashboards || []);
    setFormError('');
  };

  const toggle = (key) =>
    setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  const submitModal = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const action = modal.mode === 'approve' ? 'approve' : 'dashboards';
      const r = await api(`/admin/users/${modal.user.id}/${action}`, {
        method: 'POST',
        body: { dashboards: picked },
      });
      setModal(null);
      setNotice(r.message);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="text-muted">Approve new accounts and choose which dashboards each person can use.</div>
        <Form.Select style={{ width: 190 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All users' : s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Form.Select>
      </div>

      {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="cr-panel">
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : (
          <div className="table-responsive">
            <Table hover className="cr-table align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Dashboards</th>
                  <th>Last sign-in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No users.</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">{u.full_name}</td>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.phone}</td>
                    <td><Badge bg={badge[u.status] || 'secondary'}>{u.status}</Badge></td>
                    <td>{(u.dashboards || []).join(', ') || '-'}</td>
                    <td className="text-nowrap small">{dateTimeOf(u.last_login_at) || '-'}</td>
                    <td className="text-nowrap">
                      {u.role !== 'admin' && u.status === 'pending' && (
                        <>
                          <Button size="sm" className="me-1" onClick={() => openModal(u, 'approve')}>Approve</Button>
                          <Button size="sm" variant="outline-danger" onClick={() => act(u, 'reject', `Reject ${u.full_name}?`)}>Reject</Button>
                        </>
                      )}
                      {u.role !== 'admin' && u.status === 'approved' && (
                        <>
                          <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openModal(u, 'dashboards')}>Dashboards</Button>
                          <Button size="sm" variant="outline-danger" onClick={() => act(u, 'disable', `Disable ${u.full_name}?`)}>Disable</Button>
                        </>
                      )}
                      {u.role !== 'admin' && u.status === 'disabled' && (
                        <Button size="sm" variant="outline-success" onClick={() => act(u, 'enable')}>Enable</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <Modal show={!!modal} onHide={() => setModal(null)} backdrop="static" centered>
        <Form onSubmit={submitModal}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">
              {modal?.mode === 'approve' ? 'Approve' : 'Dashboards for'} {modal?.user.full_name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <p className="mb-2">Choose which dashboards this person can use:</p>
            {DASHBOARDS.map((d) => (
              <Form.Check
                key={d.key}
                type="checkbox"
                id={`dash-${d.key}`}
                label={d.label}
                checked={picked.includes(d.key)}
                onChange={() => toggle(d.key)}
              />
            ))}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" disabled={saving || picked.length === 0}>
              {saving ? 'Saving...' : modal?.mode === 'approve' ? 'Approve' : 'Save'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}