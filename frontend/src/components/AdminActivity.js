import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { api } from '../api';
import { dateTimeOf, daysAgo, fmt, monthStart, timeOf, today } from '../utils';

const DASH_LABEL = { stationery: 'Stationery', bank: 'Bank', account: 'Sign-in' };
const DASH_COLOR = { stationery: 'success', bank: 'primary', account: 'secondary' };
const ACTION_LABEL = { login: 'Signed in', logout: 'Signed out', create: 'Added', update: 'Edited', delete: 'Deleted' };
const ACTION_COLOR = { login: 'info', logout: 'secondary', create: 'success', update: 'warning', delete: 'danger' };
const DARK_TEXT = ['warning', 'info'];

const StatCard = ({ label, value, color = 'primary', money = false }) => (
  <Col xs={6} lg>
    <Card className={`cr-stat cr-stat-${color}`}>
      <Card.Body className="py-3">
        <div className="cr-stat-label">{label}</div>
        <div className="h4 mb-0">{money ? fmt(value) : value}</div>
      </Card.Body>
    </Card>
  </Col>
);

export default function AdminActivity() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [dashboard, setDashboard] = useState('');
  const [userId, setUserId] = useState('');
  const [people, setPeople] = useState([]);

  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [money, setMoney] = useState({ stationery: null, bank: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/users')
      .then((r) => setPeople(r.data))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (from > to) {
      setError('The "from" date cannot be after the "to" date.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      let q = `?from=${from}&to=${to}`;
      if (dashboard) q += `&dashboard=${dashboard}`;
      if (userId) q += `&user_id=${userId}`;
      const rq = `?from=${from}&to=${to}`;

      const [sum, list, st, bk] = await Promise.all([
        api('/admin/activity/summary' + q),
        api('/admin/activity' + q),
        api('/stationery/summary' + rq).catch(() => null),
        api('/bank/summary' + rq).catch(() => null),
      ]);
      setSummary(sum.data);
      setRows(list.data);
      setMoney({ stationery: st?.data?.totals ?? null, bank: bk?.data?.totals ?? null });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, dashboard, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const quick = (a, b) => {
    setFrom(a);
    setTo(b);
  };

  const t = summary?.totals;
  const showStationery = money.stationery && (dashboard === '' || dashboard === 'stationery');
  const showBank = money.bank && (dashboard === '' || dashboard === 'bank');
  const personName = people.find((p) => String(p.id) === String(userId))?.full_name;

  return (
    <>
      {/* ---------- filters ---------- */}
      <Card className="cr-panel mb-4 d-print-none">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col sm={6} lg={2}>
              <Form.Label className="small text-muted mb-1">From</Form.Label>
              <Form.Control type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small text-muted mb-1">To</Form.Label>
              <Form.Control type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Col>
            <Col sm={6} lg={3}>
              <Form.Label className="small text-muted mb-1">Dashboard</Form.Label>
              <Form.Select value={dashboard} onChange={(e) => setDashboard(e.target.value)}>
                <option value="">All activity</option>
                <option value="stationery">Stationery</option>
                <option value="bank">Bank</option>
                <option value="account">Sign-ins and sign-outs</option>
              </Form.Select>
            </Col>
            <Col sm={6} lg={3}>
              <Form.Label className="small text-muted mb-1">User</Form.Label>
              <Form.Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col lg={2} className="d-flex gap-2">
              <Button variant="outline-secondary" className="flex-fill" onClick={load}>Refresh</Button>
              <Button variant="outline-primary" className="flex-fill" onClick={() => window.print()}>Print</Button>
            </Col>
          </Row>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant="light" className="border" onClick={() => quick(today(), today())}>Today</Button>
            <Button size="sm" variant="light" className="border" onClick={() => quick(daysAgo(1), daysAgo(1))}>Yesterday</Button>
            <Button size="sm" variant="light" className="border" onClick={() => quick(daysAgo(6), today())}>Last 7 days</Button>
            <Button size="sm" variant="light" className="border" onClick={() => quick(monthStart(), today())}>This month</Button>
          </div>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="mb-3">
        <h2 className="h5 mb-0">
          Report for {from === to ? from : `${from} to ${to}`}
          {dashboard ? ` | ${DASH_LABEL[dashboard]}` : ''}
          {personName ? ` | ${personName}` : ''}
        </h2>
      </div>

      {loading || !summary ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <>
          {/* ---------- activity totals ---------- */}
          <Row className="g-3 mb-4">
            <StatCard label="Activities" value={t.activities} color="dark" />
            <StatCard label="Active users" value={t.users} color="primary" />
            <StatCard label="Sign-ins" value={t.logins} color="info" />
            <StatCard label="Entries added" value={t.entries} color="success" />
            <StatCard label="Edits / deletes" value={t.changes} color="warning" />
          </Row>

          {/* ---------- business totals for the same dates ---------- */}
          {(showStationery || showBank) && (
            <Row className="g-3 mb-4">
              {showStationery && (
                <Col lg={showBank ? 5 : 12}>
                  <Card className="cr-panel h-100">
                    <Card.Body>
                      <div className="fw-semibold mb-3">Stationery totals (all staff)</div>
                      <Row className="text-center g-2">
                        <Col><div className="text-muted small">Sales</div><div className="h5 mb-0">{fmt(money.stationery.sales)}</div></Col>
                        <Col><div className="text-muted small">Expenses</div><div className="h5 mb-0">{fmt(money.stationery.expenses)}</div></Col>
                        <Col><div className="text-muted small">Net sales</div><div className="h5 mb-0 text-success">{fmt(money.stationery.net)}</div></Col>
                        <Col><div className="text-muted small">Debt</div><div className="h5 mb-0">{fmt(money.stationery.debt)}</div></Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              )}
              {showBank && (
                <Col lg={showStationery ? 7 : 12}>
                  <Card className="cr-panel h-100">
                    <Card.Body>
                      <div className="fw-semibold mb-3">Bank totals (all staff)</div>
                      <Row className="text-center g-2">
                        <Col><div className="text-muted small">Expenditure</div><div className="h5 mb-0">{fmt(money.bank.expenditure)}</div></Col>
                        <Col><div className="text-muted small">Balance</div><div className="h5 mb-0 text-success">{fmt(money.bank.balance)}</div></Col>
                        <Col><div className="text-muted small">Unsuccessful</div><div className="h5 mb-0">{fmt(money.bank.failed)}</div></Col>
                        <Col><div className="text-muted small">Debits</div><div className="h5 mb-0">{fmt(money.bank.debit)}</div></Col>
                        <Col><div className="text-muted small">Credits</div><div className="h5 mb-0">{fmt(money.bank.credit)}</div></Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              )}
            </Row>
          )}

          {/* ---------- who did what ---------- */}
          <Card className="cr-panel mb-4">
            <Card.Header className="bg-transparent border-0 pt-3 fw-semibold">Summary by user</Card.Header>
            <div className="table-responsive">
              <Table hover className="cr-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="text-end">Sign-ins</th>
                    <th className="text-end">Entries added</th>
                    <th className="text-end">Edits / deletes</th>
                    <th className="text-end">Total</th>
                    <th>Last activity</th>
                    <th className="d-print-none"></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.users.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted py-4">No activity in this period.</td></tr>
                  )}
                  {summary.users.map((u) => (
                    <tr key={u.user_id}>
                      <td className="fw-semibold">{u.full_name}</td>
                      <td className="text-end">{u.logins}</td>
                      <td className="text-end">{u.entries}</td>
                      <td className="text-end">{u.changes}</td>
                      <td className="text-end fw-semibold">{u.total}</td>
                      <td className="small text-nowrap">{dateTimeOf(u.last_activity)}</td>
                      <td className="text-end d-print-none">
                        <Button size="sm" variant="outline-primary" onClick={() => setUserId(String(u.user_id))}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          {/* ---------- full activity log ---------- */}
          <Card className="cr-panel">
            <Card.Header className="bg-transparent border-0 pt-3 d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Activity log</span>
              <span className="text-muted small">{rows.length} {rows.length === 1 ? 'activity' : 'activities'}</span>
            </Card.Header>
            <div className="table-responsive">
              <Table hover className="cr-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>User</th>
                    <th>Dashboard</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted py-4">Nothing recorded in this period.</td></tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="text-nowrap">{String(r.created_at).slice(0, 10)}</td>
                      <td className="text-nowrap">{timeOf(r.created_at)}</td>
                      <td className="fw-semibold text-nowrap">{r.full_name}</td>
                      <td>
                        <Badge bg={DASH_COLOR[r.dashboard] || 'secondary'}>{DASH_LABEL[r.dashboard] || r.dashboard}</Badge>
                      </td>
                      <td>
                        <Badge
                          bg={ACTION_COLOR[r.action] || 'secondary'}
                          text={DARK_TEXT.includes(ACTION_COLOR[r.action]) ? 'dark' : undefined}
                        >
                          {ACTION_LABEL[r.action] || r.action}
                        </Badge>
                      </td>
                      <td>{r.description}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {rows.length >= 1000 && (
              <Card.Footer className="bg-transparent text-muted small">
                Showing the latest 1000 activities. Narrow the dates to see fewer.
              </Card.Footer>
            )}
          </Card>
        </>
      )}
    </>
  );
}