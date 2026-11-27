import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner, Tab, Table, Tabs } from 'react-bootstrap';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import DateRange from '../components/DateRange';
import { fmt, monthStart, num, timeOf, today } from '../utils';

const TYPES = [
  { key: 'failed', title: 'Unsuccessful transactions', one: 'unsuccessful transaction' },
  { key: 'debit', title: 'Debits', one: 'debit' },
  { key: 'credit', title: 'Credits', one: 'credit' },
];

const emptyRecord = () => ({
  record_date: today(),
  account_no: '',
  opening_cash: '',
  closing_cash: '',
  expenditure: '',
});

const recordFromRow = (r) => ({
  record_date: r.record_date,
  account_no: r.account_no,
  opening_cash: r.opening_cash,
  closing_cash: r.closing_cash,
  expenditure: r.expenditure,
});

const emptyEntry = (type) => ({
  entry_date: today(),
  entry_type: type,
  description: '',
  amount: '',
});

const entryFromRow = (r) => ({
  entry_date: r.entry_date,
  entry_type: r.entry_type,
  description: r.description,
  amount: r.amount,
});

export default function Bank() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [records, setRecords] = useState([]);
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({ expenditure: 0, balance: 0, failed: 0, debit: 0, credit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showRec, setShowRec] = useState(false);
  const [recId, setRecId] = useState(null);
  const [rec, setRec] = useState(emptyRecord());

  const [showEnt, setShowEnt] = useState(false);
  const [entId, setEntId] = useState(null);
  const [ent, setEnt] = useState(emptyEntry('failed'));

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = `?from=${from}&to=${to}`;
      const [r, e, s] = await Promise.all([
        api('/bank/records' + q),
        api('/bank/entries' + q),
        api('/bank/summary' + q),
      ]);
      setRecords(r.data);
      setEntries(e.data);
      setTotals(s.data.totals);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const setR = (k) => (e) => setRec((f) => ({ ...f, [k]: e.target.value }));
  const setE = (k) => (e) => setEnt((f) => ({ ...f, [k]: e.target.value }));

  // ----- records -----
  const openNewRec = () => {
    setRecId(null);
    setRec(emptyRecord());
    setFormError('');
    setShowRec(true);
  };

  const openEditRec = (r) => {
    setRecId(r.id);
    setRec(recordFromRow(r));
    setFormError('');
    setShowRec(true);
  };

  const saveRec = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const body = {
      ...rec,
      opening_cash: num(rec.opening_cash),
      closing_cash: num(rec.closing_cash),
      expenditure: num(rec.expenditure),
    };
    try {
      const r = recId
        ? await api(`/bank/records/${recId}`, { method: 'PUT', body })
        : await api('/bank/records', { method: 'POST', body });
      setShowRec(false);
      setNotice(r.message);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRec = async (r) => {
    if (!window.confirm(`Delete the record for ${r.record_date} (${r.account_no})?`)) return;
    try {
      const res = await api(`/bank/records/${r.id}`, { method: 'DELETE' });
      setNotice(res.message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  // ----- entries -----
  const openNewEnt = (type) => {
    setEntId(null);
    setEnt(emptyEntry(type));
    setFormError('');
    setShowEnt(true);
  };

  const openEditEnt = (r) => {
    setEntId(r.id);
    setEnt(entryFromRow(r));
    setFormError('');
    setShowEnt(true);
  };

  const saveEnt = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const r = entId
        ? await api(`/bank/entries/${entId}`, { method: 'PUT', body: ent })
        : await api('/bank/entries', { method: 'POST', body: ent });
      setShowEnt(false);
      setNotice(r.message);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeEnt = async (r) => {
    if (!window.confirm(`Delete "${r.description}" on ${r.entry_date}?`)) return;
    try {
      const res = await api(`/bank/entries/${r.id}`, { method: 'DELETE' });
      setNotice(res.message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const recBalance =
    Number(num(rec.opening_cash)) - (Number(num(rec.closing_cash)) + Number(num(rec.expenditure)));
  const entType = TYPES.find((t) => t.key === ent.entry_type);

  const stat = (label, value, color) => (
    <Col sm={6} lg>
      <Card className={`cr-stat cr-stat-${color}`}>
        <Card.Body className="py-3">
          <div className="cr-stat-label">{label}</div>
          <div className="h4 mb-0">{fmt(value)}</div>
        </Card.Body>
      </Card>
    </Col>
  );

  return (
    <>
      <div className="cr-page-head">
        <h1 className="h3 mb-1">Bank</h1>
        <div className="cr-soft">
          Agent: <strong>{user?.full_name || user?.username}</strong>
          {user?.phone ? <> &nbsp;|&nbsp; Tel: <strong>{user.phone}</strong></> : null}
        </div>
      </div>

      <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />

      {!isAdmin && (
        <Alert variant="light" className="border small">
          Every entry is time-stamped automatically and cannot be edited or deleted after it is saved.
          Contact the administrator to correct a mistake.
        </Alert>
      )}
      {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3 mb-4">
        {stat('Expenditure', totals.expenditure, 'danger')}
        {stat('Balance', totals.balance, 'success')}
        {stat('Unsuccessful', totals.failed, 'warning')}
        {stat('Debits', totals.debit, 'primary')}
        {stat('Credits', totals.credit, 'info')}
      </Row>

      {loading ? (
        <div className="text-center py-4"><Spinner animation="border" /></div>
      ) : (
        <Tabs defaultActiveKey="records" variant="pills" className="cr-tabs mb-3">
          <Tab eventKey="records" title="Main records">
            <Card className="cr-panel">
              <Card.Header className="bg-transparent border-0 pt-3">
                <Button onClick={openNewRec}>Add record</Button>
              </Card.Header>
              <div className="table-responsive">
                <Table hover className="cr-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Account no.</th>
                      <th className="text-end">Opening cash</th>
                      <th className="text-end">Closing cash</th>
                      <th className="text-end">Expenditure</th>
                      <th className="text-end">Balance</th>
                      <th>Recorded by</th>
                      {isAdmin && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 && (
                      <tr><td colSpan={isAdmin ? 9 : 8} className="text-center text-muted py-4">No records in this range.</td></tr>
                    )}
                    {records.map((r) => (
                      <tr key={r.id}>
                        <td className="text-nowrap">{r.record_date}</td>
                        <td className="text-nowrap">{timeOf(r.created_at)}</td>
                        <td>{r.account_no}</td>
                        <td className="text-end">{fmt(r.opening_cash)}</td>
                        <td className="text-end">{fmt(r.closing_cash)}</td>
                        <td className="text-end">{fmt(r.expenditure)}</td>
                        <td className="text-end fw-semibold">{fmt(r.balance)}</td>
                        <td>{r.recorded_by}</td>
                        {isAdmin && (
                          <td className="text-nowrap">
                            <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEditRec(r)}>Edit</Button>
                            <Button size="sm" variant="outline-danger" onClick={() => removeRec(r)}>Delete</Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          </Tab>

          {TYPES.map((t) => {
            const list = entries.filter((x) => x.entry_type === t.key);
            return (
              <Tab key={t.key} eventKey={t.key} title={`${t.title} (${list.length})`}>
                <Card className="cr-panel">
                  <Card.Header className="bg-transparent border-0 pt-3">
                    <Button onClick={() => openNewEnt(t.key)}>Add {t.one}</Button>
                  </Card.Header>
                  <div className="table-responsive">
                    <Table hover className="cr-table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Description</th>
                          <th className="text-end">Amount</th>
                          <th>Recorded by</th>
                          {isAdmin && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {list.length === 0 && (
                          <tr><td colSpan={isAdmin ? 6 : 5} className="text-center text-muted py-4">Nothing in this range.</td></tr>
                        )}
                        {list.map((r) => (
                          <tr key={r.id}>
                            <td className="text-nowrap">{r.entry_date}</td>
                            <td className="text-nowrap">{timeOf(r.created_at)}</td>
                            <td>{r.description}</td>
                            <td className="text-end fw-semibold">{fmt(r.amount)}</td>
                            <td>{r.recorded_by}</td>
                            {isAdmin && (
                              <td className="text-nowrap">
                                <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEditEnt(r)}>Edit</Button>
                                <Button size="sm" variant="outline-danger" onClick={() => removeEnt(r)}>Delete</Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card>
              </Tab>
            );
          })}
        </Tabs>
      )}

      {/* Record modal */}
      <Modal show={showRec} onHide={() => setShowRec(false)} backdrop="static" centered>
        <Form onSubmit={saveRec}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">{recId ? 'Edit record' : 'Add record'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Row className="g-2">
              <Col sm={6}>
                <Form.Label>Date</Form.Label>
                <Form.Control type="date" value={rec.record_date} onChange={setR('record_date')} required />
              </Col>
              <Col sm={6}>
                <Form.Label>Account no.</Form.Label>
                <Form.Control value={rec.account_no} onChange={setR('account_no')} maxLength={50} required />
              </Col>
              <Col sm={4}>
                <Form.Label>Opening cash</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={rec.opening_cash} onChange={setR('opening_cash')} />
              </Col>
              <Col sm={4}>
                <Form.Label>Closing cash</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={rec.closing_cash} onChange={setR('closing_cash')} />
              </Col>
              <Col sm={4}>
                <Form.Label>Expenditure</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={rec.expenditure} onChange={setR('expenditure')} />
              </Col>
            </Row>
            <div className="mt-3">
              Balance: <strong>{fmt(recBalance)}</strong>
              <div className="text-muted small">Opening cash minus (closing cash + expenditure)</div>
            </div>
            {!recId && (
              <div className="text-muted small mt-2">
                Once saved, this record cannot be changed by staff. The time is added automatically.
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowRec(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Entry modal */}
      <Modal show={showEnt} onHide={() => setShowEnt(false)} backdrop="static" centered>
        <Form onSubmit={saveEnt}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">{entId ? 'Edit' : 'Add'} {entType?.one}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Row className="g-2">
              <Col sm={6}>
                <Form.Label>Date</Form.Label>
                <Form.Control type="date" value={ent.entry_date} onChange={setE('entry_date')} required />
              </Col>
              <Col sm={6}>
                <Form.Label>Amount</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={ent.amount} onChange={setE('amount')} required />
              </Col>
              <Col xs={12}>
                <Form.Label>Description</Form.Label>
                <Form.Control value={ent.description} onChange={setE('description')} maxLength={150} required />
              </Col>
            </Row>
            {!entId && (
              <div className="text-muted small mt-3">
                Once saved, this entry cannot be changed by staff. The time is added automatically.
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEnt(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}