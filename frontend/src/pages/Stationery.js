import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Tab, Table, Tabs } from 'react-bootstrap';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import DateRange from '../components/DateRange';
import { fmt, monthStart, num, timeOf, today } from '../utils';
import '../stationery.css';

// ===========================================================================
// Constants, blank forms and small helpers
// ===========================================================================

/** Value of the "Others" option in the item dropdown. */
const OTHER = 'other';

// ----- blank forms -----
const emptySale = () => ({
  sale_date: today(),
  item_id: '',
  item: '',
  qty: '1',
  rate: '',
  balance: '',
  debt: '',
  name: '',
  contact: '',
});

const emptyExpense = () => ({ expense_date: today(), description: '', amount: '' });

const emptyStock = () => ({ received_date: today(), item: '', qty: '1', unit_cost: '' });

/** Turn a saved sale row into form values. Items that are no longer listed open as "Others". */
const saleFromRow = (r, items) => {
  const known = items.find((i) => String(i.id) === String(r.item_id));
  return {
    sale_date: r.sale_date,
    item_id: known ? String(known.id) : OTHER,
    item: known ? '' : r.item,
    qty: String(r.qty),
    rate: known ? '' : r.rate,
    balance: r.balance,
    debt: r.debt,
    name: r.name ?? '',
    contact: r.contact ?? '',
  };
};

// ----- dates -----
const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysBack = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
};

const shortDate = (s) => {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// ----- small utilities -----
/** Join the non-empty parts with a dot: "5 Mar · 14:02 · Sarah". */
const line = (...parts) => parts.filter(Boolean).join(' · ');

/** Sum one numeric column of a list of rows. */
const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key]), 0);

/** onChange handler that writes an input's value into one key of a form object. */
const field = (setter, key) => (e) => setter((f) => ({ ...f, [key]: e.target.value }));

/** Plus/minus buttons for a quantity field. Never goes below 1. */
const stepQty = (setter, delta) =>
  setter((f) => ({ ...f, qty: String(Math.max(1, (parseInt(f.qty, 10) || 1) + delta)) }));

// ===========================================================================
// Loading the data
// ===========================================================================

const EMPTY = {
  sales: [],
  expenses: [],
  inventory: [],
  summary: { totals: { sales: 0, expenses: 0, debt: 0, net: 0 }, days: [] },
  items: [],
  allItems: [],
  debtors: [],
  payments: [],
};

/**
 * Loads everything the Stationery page shows for the chosen date range.
 * Call reload() after any change to refresh all lists.
 */
function useStationeryData(isAdmin) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      const q = `?from=${from}&to=${to}`;
      const [sales, expenses, inventory, summary, items, debtors, payments, allItems] = await Promise.all([
        api('/stationery/sales' + q),
        api('/stationery/expenses' + q),
        api('/stationery/inventory' + q),
        api('/stationery/summary' + q),
        api('/stationery/items'),
        api('/stationery/debtors'),
        api('/stationery/payments' + q),
        isAdmin ? api('/stationery/items/all') : Promise.resolve({ data: [] }),
      ]);
      setData({
        sales: sales.data,
        expenses: expenses.data,
        inventory: inventory.data,
        summary: summary.data,
        items: items.data,
        allItems: allItems.data,
        debtors: debtors.data,
        payments: payments.data,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setReady(true);
    }
  }, [from, to, isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { from, setFrom, to, setTo, data, ready, error, setError, reload };
}

// ===========================================================================
// Phone cards
// ===========================================================================

// ----- phone cards -----

/** Shared shape of every phone card: title and amount on top, grey lines under it. */
function RecordCard({ title, amount, amountClass = '', meta = [], children }) {
  return (
    <div className="st-card">
      <div className="st-card-top">
        <div className="st-card-title">{title}</div>
        <div className={`st-card-amount${amountClass ? ` ${amountClass}` : ''}`}>{amount}</div>
      </div>
      {meta.filter(Boolean).map((m, i) => (
        <div className="st-card-meta" key={i}>{m}</div>
      ))}
      {children}
    </div>
  );
}

function RowActions({ row, onEdit, onDelete, className = 'd-flex gap-2 mt-2' }) {
  return (
    <div className={className}>
      <Button size="sm" variant="outline-primary" className="flex-fill" onClick={() => onEdit(row)}>Edit</Button>
      <Button size="sm" variant="outline-danger" className="flex-fill" onClick={() => onDelete(row)}>Delete</Button>
    </div>
  );
}

const ItemTitle = ({ item, qty }) => (
  <>
    {item} <span className="text-muted fw-normal">× {qty}</span>
  </>
);

function SaleCard({ r, isAdmin, onPay, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const owing = Number(r.owing);
  const hasDebt = Number(r.debt) > 0;
  return (
    <RecordCard
      title={<ItemTitle item={r.item} qty={r.qty} />}
      amount={fmt(r.amount)}
      meta={[line(shortDate(r.sale_date), timeOf(r.created_at), r.recorded_by), line(r.name, r.contact)]}
    >
      {owing > 0 && <div className="st-card-debt">Owing {fmt(owing)}</div>}
      {owing <= 0 && hasDebt && <Badge bg="success" className="mt-2">Debt cleared</Badge>}
      {owing > 0 && (
        <Button variant="success" className="w-100 mt-2" onClick={() => onPay(r)}>Receive payment</Button>
      )}
      <button type="button" className="st-more" onClick={() => setOpen(!open)}>
        {open ? 'Less' : 'More'}
      </button>
      {open && (
        <div className="st-card-more">
          <div><span>Rate</span><strong>{fmt(r.rate)}</strong></div>
          <div><span>Balance</span><strong>{fmt(r.balance)}</strong></div>
          <div><span>Debt</span><strong>{fmt(r.debt)}</strong></div>
          {isAdmin && <RowActions row={r} onEdit={onEdit} onDelete={onDelete} className="gap-2 mt-2" />}
        </div>
      )}
    </RecordCard>
  );
}

function ExpenseCard({ r, isAdmin, onEdit, onDelete }) {
  return (
    <RecordCard
      title={r.description}
      amount={fmt(r.amount)}
      meta={[line(shortDate(r.expense_date), timeOf(r.created_at), r.recorded_by)]}
    >
      {isAdmin && <RowActions row={r} onEdit={onEdit} onDelete={onDelete} />}
    </RecordCard>
  );
}

function StockCard({ r, isAdmin, onEdit, onDelete }) {
  return (
    <RecordCard
      title={<ItemTitle item={r.item} qty={r.qty} />}
      amount={fmt(r.total_cost)}
      meta={[line(shortDate(r.received_date), timeOf(r.created_at), r.recorded_by), `Unit cost ${fmt(r.unit_cost)}`]}
    >
      {isAdmin && <RowActions row={r} onEdit={onEdit} onDelete={onDelete} />}
    </RecordCard>
  );
}

function DebtorCard({ r, onPay }) {
  return (
    <RecordCard
      title={r.name || <span className="text-muted">No name</span>}
      amount={fmt(r.owing)}
      amountClass="text-danger"
      meta={[line(r.contact, r.item), `Taken ${shortDate(r.sale_date)} · debt ${fmt(r.debt)}, paid ${fmt(r.paid)}`]}
    >
      <Button variant="success" className="w-100 mt-2" onClick={() => onPay(r)}>Receive payment</Button>
    </RecordCard>
  );
}

function PaymentCard({ r }) {
  return (
    <RecordCard
      title={r.name || r.item}
      amount={fmt(r.amount)}
      meta={[
        line(`Paid ${shortDate(r.paid_date)}`, timeOf(r.created_at), r.recorded_by),
        line(r.item, `debt taken ${shortDate(r.sale_date)}`),
      ]}
    />
  );
}

function SummaryCard({ d }) {
  return (
    <RecordCard title={shortDate(d.date)} amount={fmt(d.net)} meta={['Net sales']}>
      <div className="st-split">
        <div><span>Sales</span><strong>{fmt(d.sales)}</strong></div>
        <div><span>Expenses</span><strong>{fmt(d.expenses)}</strong></div>
        <div><span>Debt owing</span><strong>{fmt(d.debt)}</strong></div>
      </div>
    </RecordCard>
  );
}

/** One editable row in the "Items and rates" tab (admin only). */
function ItemRow({ item, onSave }) {
  const [name, setName] = useState(item.name);
  const [rate, setRate] = useState(String(item.rate));
  const [active, setActive] = useState(Number(item.is_active) === 1);
  const [busy, setBusy] = useState(false);

  const dirty =
    name !== item.name ||
    Number(rate) !== Number(item.rate) ||
    active !== (Number(item.is_active) === 1);

  const save = async () => {
    setBusy(true);
    await onSave(item.id, { name, rate, is_active: active });
    setBusy(false);
  };

  return (
    <div className={`st-item-edit${active ? '' : ' off'}`}>
      <Form.Control
        className="st-item-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
      />
      <Form.Control
        className="st-item-rate"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
      />
      <Form.Check
        type="switch"
        id={`item-active-${item.id}`}
        label={active ? 'Shown in sales' : 'Hidden'}
        checked={active}
        onChange={(e) => setActive(e.target.checked)}
      />
      <Button className="st-item-save" disabled={!dirty || busy} onClick={save}>
        {busy ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}

// ===========================================================================
// Forms (popups)
// ===========================================================================

/**
 * Saving state shared by all the forms.
 * submit(check, request) returns a form onSubmit handler:
 *   check()   returns an error message, or '' when the form is fine
 *   request() sends the save and returns the API reply
 */
function useSubmit(onSaved) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = (check, request) => async (e) => {
    e.preventDefault();
    setError('');
    const problem = check ? check() : '';
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const r = await request();
      onSaved(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return { error, setError, saving, submit };
}

/** Modal frame with the title, error box and Cancel / Save buttons. */
function FormModal({ show, onHide, title, onSubmit, error, saving, submitLabel, submitVariant = 'primary', scrollable = false, children }) {
  return (
    <Modal
      show={show}
      onHide={onHide}
      backdrop="static"
      centered
      scrollable={scrollable}
      fullscreen="sm-down"
      className="st-modal"
    >
      <Form
        onSubmit={onSubmit}
        className={scrollable ? 'd-flex flex-column overflow-hidden' : 'd-flex flex-column flex-grow-1'}
      >
        <Modal.Header closeButton>
          <Modal.Title className="h5">{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {children}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancel</Button>
          <Button type="submit" variant={submitVariant} disabled={saving}>
            {saving ? 'Saving...' : submitLabel}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

const Amount = ({ label, value }) => (
  <div className="st-amount">
    <span>{label}</span>
    <strong>{fmt(value)}</strong>
  </div>
);

const Qty = ({ value, onChange, onStep, className }) => (
  <>
    <Form.Label className={className}>Qty</Form.Label>
    <div className="st-stepper">
      <Button type="button" variant="outline-secondary" onClick={() => onStep(-1)}>-</Button>
      <Form.Control
        type="number"
        inputMode="numeric"
        min="1"
        step="1"
        value={value}
        onChange={onChange}
        required
      />
      <Button type="button" variant="outline-secondary" onClick={() => onStep(1)}>+</Button>
    </div>
  </>
);

const MoneyInput = ({ value, onChange, required = false }) => (
  <Form.Control
    type="number"
    inputMode="decimal"
    min="0"
    step="0.01"
    value={value}
    onChange={onChange}
    required={required}
  />
);

// ---------------------------------------------------------------------------
// Sale (add and edit). row = the sale being edited, or null for a new sale.
// ---------------------------------------------------------------------------
function SaleModal({ show, row, items, onHide, onSaved }) {
  const [sale, setSale] = useState(emptySale());
  const { error, setError, saving, submit } = useSubmit(onSaved);
  const set = (k) => field(setSale, k);

  useEffect(() => {
    if (!show) return;
    setSale(row ? saleFromRow(row, items) : emptySale());
    setError('');
  }, [show, row, items, setError]);

  const isOther = sale.item_id === OTHER;
  const catalogItem = items.find((i) => String(i.id) === String(sale.item_id));

  // Editing keeps the rate the sale was made at, unless another item is chosen.
  let rate = 0;
  if (isOther) {
    rate = Number(sale.rate || 0);
  } else if (catalogItem) {
    const sameAsSaved = row && String(row.item_id) === String(sale.item_id);
    rate = sameAsSaved ? Number(row.rate) : Number(catalogItem.rate);
  }
  const amount = Number(sale.qty || 0) * rate;

  const save = submit(
    () => {
      if (!sale.item_id) return 'Choose an item.';
      if (num(sale.debt) > amount) return 'Debt cannot be more than the amount.';
      return '';
    },
    () => {
      const body = {
        sale_date: sale.sale_date,
        item_id: isOther ? null : Number(sale.item_id),
        item: isOther ? sale.item : '',
        qty: sale.qty,
        rate: isOther ? sale.rate : null,
        balance: num(sale.balance),
        debt: num(sale.debt),
        name: sale.name,
        contact: sale.contact,
      };
      return row
        ? api(`/stationery/sales/${row.id}`, { method: 'PUT', body })
        : api('/stationery/sales', { method: 'POST', body });
    }
  );

  return (
    <FormModal
      show={show}
      onHide={onHide}
      title={row ? 'Edit sale' : 'Add sale'}
      onSubmit={save}
      error={error}
      saving={saving}
      submitLabel="Save sale"
      scrollable
    >
      <Row className="g-2">
        <Col xs={12}>
          <Form.Label>Date</Form.Label>
          <Form.Control type="date" value={sale.sale_date} onChange={set('sale_date')} required />
        </Col>

        <Col xs={12}>
          <Form.Label className="mt-1">Item</Form.Label>
          <Form.Select value={sale.item_id} onChange={set('item_id')} required>
            <option value="">Choose item...</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({fmt(i.rate)})</option>
            ))}
            <option value={OTHER}>Others (type name and rate)</option>
          </Form.Select>
        </Col>

        {isOther && (
          <Col xs={12}>
            <Form.Label className="mt-2">Item name</Form.Label>
            <Form.Control value={sale.item} onChange={set('item')} maxLength={150} required />
          </Col>
        )}

        <Col xs={7}>
          <Qty className="mt-2" value={sale.qty} onChange={set('qty')} onStep={(d) => stepQty(setSale, d)} />
        </Col>
        <Col xs={5}>
          <Form.Label className="mt-2">Rate</Form.Label>
          {isOther ? (
            <MoneyInput value={sale.rate} onChange={set('rate')} required />
          ) : (
            <Form.Control value={sale.item_id ? fmt(rate) : ''} readOnly disabled />
          )}
        </Col>
      </Row>

      <Amount label="Amount" value={amount} />

      <Row className="g-2 mt-1">
        <Col xs={6}>
          <Form.Label>Debt (unpaid part)</Form.Label>
          <MoneyInput value={sale.debt} onChange={set('debt')} />
        </Col>
        <Col xs={6}>
          <Form.Label>Balance</Form.Label>
          <MoneyInput value={sale.balance} onChange={set('balance')} />
        </Col>
        <Col xs={12} sm={6}>
          <Form.Label>Name (optional)</Form.Label>
          <Form.Control value={sale.name} onChange={set('name')} maxLength={100} />
        </Col>
        <Col xs={12} sm={6}>
          <Form.Label>Contact (optional)</Form.Label>
          <Form.Control type="tel" inputMode="tel" value={sale.contact} onChange={set('contact')} maxLength={50} />
        </Col>
      </Row>

      <div className="text-muted small mt-3">
        If the customer has not paid in full, enter the unpaid part as Debt and add their name and contact.
        The debt is counted in sales once it is paid.
      </div>
      {!row && (
        <div className="text-muted small mt-2">
          Once saved, this sale cannot be changed by staff. The time and your name are added automatically.
        </div>
      )}
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Debt payment. row = the sale (or debtor) being paid.
// ---------------------------------------------------------------------------
function PaymentModal({ show, row, onHide, onSaved }) {
  const [amount, setAmount] = useState('');
  const { error, setError, saving, submit } = useSubmit(onSaved);

  useEffect(() => {
    if (!show || !row) return;
    setAmount(String(Number(row.owing)));
    setError('');
  }, [show, row, setError]);

  const save = submit(
    () => {
      const owing = Number(row.owing);
      const value = Number(amount);
      if (!(value > 0)) return 'Enter the amount paid.';
      if (value > owing) return `Payment is more than the amount owing (${fmt(owing)}).`;
      return '';
    },
    () => api(`/stationery/sales/${row.id}/payments`, { method: 'POST', body: { amount } })
  );

  return (
    <FormModal
      show={show}
      onHide={onHide}
      title="Receive payment"
      onSubmit={save}
      error={error}
      saving={saving}
      submitLabel="Save payment"
      submitVariant="success"
    >
      {row && (
        <>
          <div className="mb-3">
            <div><strong>{row.name || 'No name'}</strong>{row.contact ? ` · ${row.contact}` : ''}</div>
            <div className="text-muted small">{row.item}, sold on {row.sale_date}</div>
            <Amount label="Amount owing" value={row.owing} />
          </div>
          <Form.Label>Amount paid now</Form.Label>
          <Form.Control
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Form.Text className="text-muted d-block mt-2">
            You can enter part of the debt. The amount is added to the sales of {row.sale_date}, the day the
            debt was taken. A payment cannot be changed after it is saved.
          </Form.Text>
        </>
      )}
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Expense (add and edit)
// ---------------------------------------------------------------------------
function ExpenseModal({ show, row, onHide, onSaved }) {
  const [exp, setExp] = useState(emptyExpense());
  const { error, setError, saving, submit } = useSubmit(onSaved);
  const set = (k) => field(setExp, k);

  useEffect(() => {
    if (!show) return;
    setExp(row ? { expense_date: row.expense_date, description: row.description, amount: row.amount } : emptyExpense());
    setError('');
  }, [show, row, setError]);

  const save = submit(null, () =>
    row
      ? api(`/stationery/expenses/${row.id}`, { method: 'PUT', body: exp })
      : api('/stationery/expenses', { method: 'POST', body: exp })
  );

  return (
    <FormModal
      show={show}
      onHide={onHide}
      title={row ? 'Edit expense' : 'Add expense'}
      onSubmit={save}
      error={error}
      saving={saving}
      submitLabel="Save expense"
    >
      <Row className="g-2">
        <Col xs={12} sm={6}>
          <Form.Label>Date</Form.Label>
          <Form.Control type="date" value={exp.expense_date} onChange={set('expense_date')} required />
        </Col>
        <Col xs={12} sm={6}>
          <Form.Label>Amount</Form.Label>
          <MoneyInput value={exp.amount} onChange={set('amount')} required />
        </Col>
        <Col xs={12}>
          <Form.Label>Description</Form.Label>
          <Form.Control value={exp.description} onChange={set('description')} maxLength={150} required />
        </Col>
      </Row>
      <Form.Text className="text-muted d-block mt-2">
        Add as many expenses as you need per day. Each day's total is subtracted from that day's sales.
        {!row && ' Once saved, an expense cannot be changed by staff.'}
      </Form.Text>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Stock received (add and edit)
// ---------------------------------------------------------------------------
function StockModal({ show, row, onHide, onSaved }) {
  const [stock, setStock] = useState(emptyStock());
  const { error, setError, saving, submit } = useSubmit(onSaved);
  const set = (k) => field(setStock, k);

  useEffect(() => {
    if (!show) return;
    setStock(
      row
        ? { received_date: row.received_date, item: row.item, qty: String(row.qty), unit_cost: row.unit_cost }
        : emptyStock()
    );
    setError('');
  }, [show, row, setError]);

  const total = Number(stock.qty || 0) * Number(stock.unit_cost || 0);

  const save = submit(null, () =>
    row
      ? api(`/stationery/inventory/${row.id}`, { method: 'PUT', body: stock })
      : api('/stationery/inventory', { method: 'POST', body: stock })
  );

  return (
    <FormModal
      show={show}
      onHide={onHide}
      title={row ? 'Edit stock' : 'Add stock'}
      onSubmit={save}
      error={error}
      saving={saving}
      submitLabel="Save stock"
    >
      <Row className="g-2">
        <Col xs={12} sm={6}>
          <Form.Label>Date received</Form.Label>
          <Form.Control type="date" value={stock.received_date} onChange={set('received_date')} required />
        </Col>
        <Col xs={12} sm={6}>
          <Form.Label>Item</Form.Label>
          <Form.Control value={stock.item} onChange={set('item')} maxLength={150} required />
        </Col>
        <Col xs={6}>
          <Qty value={stock.qty} onChange={set('qty')} onStep={(d) => stepQty(setStock, d)} />
        </Col>
        <Col xs={6}>
          <Form.Label>Unit cost</Form.Label>
          <MoneyInput value={stock.unit_cost} onChange={set('unit_cost')} required />
        </Col>
      </Row>
      <Amount label="Total cost" value={total} />
      {!row && (
        <div className="text-muted small mt-3">
          Once saved, this record cannot be changed by staff. The time and your name are added automatically.
        </div>
      )}
    </FormModal>
  );
}

// ===========================================================================
// Tab contents
// ===========================================================================

// ----- layout pieces shared by the panels -----

/** Wide table for PC. Hidden on phones, where the cards are shown instead. */
const DesktopTable = ({ children }) => (
  <div className="table-responsive d-none d-md-block">
    <Table hover className="cr-table align-middle mb-0">{children}</Table>
  </div>
);

const EmptyRow = ({ cols, children }) => (
  <tr><td colSpan={cols} className="text-center text-muted py-4">{children}</td></tr>
);

/** List of cards for phones. Hidden on PC. */
const PhoneList = ({ rows, empty, render, heading }) => (
  <div className="d-md-none">
    {heading && <div className="st-subhead">{heading}</div>}
    <div className="st-cards">
      {rows.length === 0 && <div className="st-empty">{empty}</div>}
      {rows.map(render)}
    </div>
  </div>
);

const PanelHeader = ({ title, children }) => (
  <Card.Header className="bg-transparent border-0 pt-3">
    <div className="h5 mb-0">{title}</div>
    <div className="text-muted small">{children}</div>
  </Card.Header>
);

const Th = ({ end, children }) => <th className={end ? 'text-end' : undefined}>{children}</th>;

// ---------------------------------------------------------------------------
// Sales + inventory
// ---------------------------------------------------------------------------
function SalesPanel({
  sales, inventory, isAdmin,
  onAddSale, onPay, onEditSale, onDeleteSale,
  onAddStock, onEditStock, onDeleteStock,
}) {
  const inventoryTotal = sum(inventory, 'total_cost');

  return (
    <>
      <Card className="cr-panel mb-4">
        <Card.Header className="bg-transparent border-0 pt-3 d-none d-md-block">
          <Button onClick={onAddSale}>Add sale</Button>
        </Card.Header>

        <DesktopTable>
          <thead>
            <tr>
              <Th>Date</Th><Th>Time</Th><Th>Item</Th>
              <Th end>Qty</Th><Th end>Rate</Th><Th end>Amount</Th><Th end>Balance</Th><Th end>Debt</Th><Th end>Owing</Th>
              <Th>Name</Th><Th>Contact</Th><Th>Recorded by</Th><th></th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && <EmptyRow cols={13}>No sales in this range.</EmptyRow>}
            {sales.map((r) => {
              const owing = Number(r.owing);
              const hasDebt = Number(r.debt) > 0;
              return (
                <tr key={r.id}>
                  <td className="text-nowrap">{r.sale_date}</td>
                  <td className="text-nowrap">{timeOf(r.created_at)}</td>
                  <td>{r.item}</td>
                  <td className="text-end">{r.qty}</td>
                  <td className="text-end">{fmt(r.rate)}</td>
                  <td className="text-end fw-semibold">{fmt(r.amount)}</td>
                  <td className="text-end">{fmt(r.balance)}</td>
                  <td className="text-end">{fmt(r.debt)}</td>
                  <td className="text-end">
                    {owing > 0 ? (
                      <span className="fw-semibold text-danger">{fmt(owing)}</span>
                    ) : hasDebt ? (
                      <Badge bg="success">Cleared</Badge>
                    ) : null}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.contact}</td>
                  <td>{r.recorded_by}</td>
                  <td className="text-nowrap">
                    {owing > 0 && (
                      <Button size="sm" variant="success" className="me-1" onClick={() => onPay(r)}>
                        Receive payment
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline-primary" className="me-1" onClick={() => onEditSale(r)}>Edit</Button>
                        <Button size="sm" variant="outline-danger" onClick={() => onDeleteSale(r)}>Delete</Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DesktopTable>

        <PhoneList
          heading={`Sales (${sales.length})`}
          rows={sales}
          empty="No sales in this range."
          render={(r) => (
            <SaleCard key={r.id} r={r} isAdmin={isAdmin} onPay={onPay} onEdit={onEditSale} onDelete={onDeleteSale} />
          )}
        />
      </Card>

      <Card className="cr-panel">
        <Card.Header className="bg-transparent border-0 pt-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <div className="h5 mb-0">Inventory</div>
            <div className="text-muted small">Items received and what they cost. Separate from sales.</div>
          </div>
          <Button className="d-none d-md-inline-block" onClick={onAddStock}>Add stock</Button>
        </Card.Header>

        <DesktopTable>
          <thead>
            <tr>
              <Th>Date received</Th><Th>Time</Th><Th>Item</Th>
              <Th end>Qty</Th><Th end>Unit cost</Th><Th end>Total cost</Th><Th>Recorded by</Th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {inventory.length === 0 && (
              <EmptyRow cols={isAdmin ? 8 : 7}>No stock received in this range.</EmptyRow>
            )}
            {inventory.map((r) => (
              <tr key={r.id}>
                <td className="text-nowrap">{r.received_date}</td>
                <td className="text-nowrap">{timeOf(r.created_at)}</td>
                <td>{r.item}</td>
                <td className="text-end">{r.qty}</td>
                <td className="text-end">{fmt(r.unit_cost)}</td>
                <td className="text-end fw-semibold">{fmt(r.total_cost)}</td>
                <td>{r.recorded_by}</td>
                {isAdmin && (
                  <td className="text-nowrap">
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => onEditStock(r)}>Edit</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => onDeleteStock(r)}>Delete</Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {inventory.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className="text-end fw-semibold">Total cost in this range</td>
                <td className="text-end fw-semibold">{fmt(inventoryTotal)}</td>
                <td colSpan={isAdmin ? 2 : 1}></td>
              </tr>
            </tfoot>
          )}
        </DesktopTable>

        <PhoneList
          rows={inventory}
          empty="No stock received in this range."
          render={(r) => (
            <StockCard key={r.id} r={r} isAdmin={isAdmin} onEdit={onEditStock} onDelete={onDeleteStock} />
          )}
        />
        {inventory.length > 0 && (
          <div className="d-md-none text-end fw-semibold mt-2">Total cost: {fmt(inventoryTotal)}</div>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
function ExpensesPanel({ expenses, isAdmin, onAdd, onEdit, onDelete }) {
  return (
    <Card className="cr-panel">
      <Card.Header className="bg-transparent border-0 pt-3 d-none d-md-block">
        <Button onClick={onAdd}>Add expense</Button>
      </Card.Header>

      <DesktopTable>
        <thead>
          <tr>
            <Th>Date</Th><Th>Time</Th><Th>Description</Th><Th end>Amount</Th><Th>Recorded by</Th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 && <EmptyRow cols={isAdmin ? 6 : 5}>No expenses in this range.</EmptyRow>}
          {expenses.map((r) => (
            <tr key={r.id}>
              <td className="text-nowrap">{r.expense_date}</td>
              <td className="text-nowrap">{timeOf(r.created_at)}</td>
              <td>{r.description}</td>
              <td className="text-end fw-semibold">{fmt(r.amount)}</td>
              <td>{r.recorded_by}</td>
              {isAdmin && (
                <td className="text-nowrap">
                  <Button size="sm" variant="outline-primary" className="me-1" onClick={() => onEdit(r)}>Edit</Button>
                  <Button size="sm" variant="outline-danger" onClick={() => onDelete(r)}>Delete</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </DesktopTable>

      <PhoneList
        heading={`Expenses (${expenses.length})`}
        rows={expenses}
        empty="No expenses in this range."
        render={(r) => <ExpenseCard key={r.id} r={r} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Debtors + payments received
// ---------------------------------------------------------------------------
function DebtorsPanel({ debtors, payments, onPay }) {
  const totalOwing = sum(debtors, 'owing');

  return (
    <>
      <Card className="cr-panel mb-4">
        <PanelHeader title="Who still owes">
          All unpaid debts, whatever the date. Total owing: <strong>{fmt(totalOwing)}</strong>
        </PanelHeader>

        <DesktopTable>
          <thead>
            <tr>
              <Th>Date taken</Th><Th>Name</Th><Th>Contact</Th><Th>Item</Th>
              <Th end>Amount</Th><Th end>Debt</Th><Th end>Paid</Th><Th end>Owing</Th><Th>Recorded by</Th><th></th>
            </tr>
          </thead>
          <tbody>
            {debtors.length === 0 && <EmptyRow cols={10}>Nobody owes anything.</EmptyRow>}
            {debtors.map((r) => (
              <tr key={r.id}>
                <td className="text-nowrap">{r.sale_date}</td>
                <td>{r.name || <span className="text-muted">No name</span>}</td>
                <td>{r.contact}</td>
                <td>{r.item}</td>
                <td className="text-end">{fmt(r.amount)}</td>
                <td className="text-end">{fmt(r.debt)}</td>
                <td className="text-end">{fmt(r.paid)}</td>
                <td className="text-end fw-semibold text-danger">{fmt(r.owing)}</td>
                <td>{r.recorded_by}</td>
                <td className="text-nowrap">
                  <Button size="sm" variant="success" onClick={() => onPay(r)}>Receive payment</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </DesktopTable>

        <PhoneList
          rows={debtors}
          empty="Nobody owes anything."
          render={(r) => <DebtorCard key={r.id} r={r} onPay={onPay} />}
        />
      </Card>

      <Card className="cr-panel">
        <PanelHeader title="Payments received in this date range">
          Each payment is counted in the sales of the day the debt was taken.
        </PanelHeader>

        <DesktopTable>
          <thead>
            <tr>
              <Th>Paid on</Th><Th>Time</Th><Th>Name</Th><Th>Item</Th><Th>Debt taken</Th>
              <Th end>Amount paid</Th><Th>Received by</Th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && <EmptyRow cols={7}>No payments in this range.</EmptyRow>}
            {payments.map((r) => (
              <tr key={r.id}>
                <td className="text-nowrap">{r.paid_date}</td>
                <td className="text-nowrap">{timeOf(r.created_at)}</td>
                <td>{r.name}</td>
                <td>{r.item}</td>
                <td className="text-nowrap">{r.sale_date}</td>
                <td className="text-end fw-semibold">{fmt(r.amount)}</td>
                <td>{r.recorded_by}</td>
              </tr>
            ))}
          </tbody>
        </DesktopTable>

        <PhoneList
          rows={payments}
          empty="No payments in this range."
          render={(r) => <PaymentCard key={r.id} r={r} />}
        />
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Daily summary
// ---------------------------------------------------------------------------
function SummaryPanel({ days }) {
  return (
    <Card className="cr-panel">
      <DesktopTable>
        <thead>
          <tr>
            <Th>Date</Th><Th end>Sales</Th><Th end>Expenses</Th><Th end>Net sales</Th><Th end>Debt owing</Th>
          </tr>
        </thead>
        <tbody>
          {days.length === 0 && <EmptyRow cols={5}>Nothing in this range.</EmptyRow>}
          {days.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td className="text-end">{fmt(d.sales)}</td>
              <td className="text-end">{fmt(d.expenses)}</td>
              <td className="text-end fw-semibold">{fmt(d.net)}</td>
              <td className="text-end">{fmt(d.debt)}</td>
            </tr>
          ))}
        </tbody>
      </DesktopTable>

      <PhoneList rows={days} empty="Nothing in this range." render={(d) => <SummaryCard key={d.date} d={d} />} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Items and rates (admin)
// onAddItem(newItem) resolves true when the item was saved.
// ---------------------------------------------------------------------------
function ItemsPanel({ allItems, onSaveItem, onAddItem }) {
  const [newItem, setNewItem] = useState({ name: '', rate: '' });
  const setField = (k) => (e) => setNewItem((f) => ({ ...f, [k]: e.target.value }));

  const add = async (e) => {
    e.preventDefault();
    if (await onAddItem(newItem)) setNewItem({ name: '', rate: '' });
  };

  return (
    <Card className="cr-panel">
      <PanelHeader title="Items and rates">
        A new rate applies to new sales only. Old sales keep the rate they were sold at.
      </PanelHeader>

      <div className="st-item-list">
        {allItems.map((it) => (
          <ItemRow key={`${it.id}-${it.name}-${it.rate}-${it.is_active}`} item={it} onSave={onSaveItem} />
        ))}
      </div>

      <Card.Body>
        <Form onSubmit={add}>
          <Row className="g-2 align-items-end">
            <Col md={5}>
              <Form.Label>New item</Form.Label>
              <Form.Control value={newItem.name} onChange={setField('name')} maxLength={100} required />
            </Col>
            <Col xs={7} md={4}>
              <Form.Label>Rate</Form.Label>
              <Form.Control
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={newItem.rate}
                onChange={setField('rate')}
                required
              />
            </Col>
            <Col xs={5} md={3}>
              <Button type="submit" className="w-100">Add item</Button>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}

// ===========================================================================
// The page
// ===========================================================================

const STATS = [
  { label: 'Total sales', key: 'sales', color: 'primary' },
  { label: 'Expenses', key: 'expenses', color: 'danger' },
  { label: 'Net sales', key: 'net', color: 'success' },
  { label: 'Debt owing', key: 'debt', color: 'warning' },
];

export default function Stationery() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const { from, setFrom, to, setTo, data, ready, error, setError, reload } = useStationeryData(isAdmin);
  const { sales, expenses, inventory, summary, items, allItems, debtors, payments } = data;

  const [tab, setTab] = useState('sales');
  const [fabOpen, setFabOpen] = useState(false);
  const [notice, setNotice] = useState('');

  // Which form is open, and the row it edits (null = a new record).
  // The row is kept after closing so the modal does not go blank while it fades out.
  const [modal, setModal] = useState({ type: null, row: null });
  const openModal = (type, row = null) => setModal({ type, row });
  const closeModal = () => setModal((m) => ({ ...m, type: null }));

  const saved = async (message) => {
    closeModal();
    setNotice(message);
    await reload();
  };

  /** Run a change on the server, show its message, refresh. Returns true when it worked. */
  const mutate = async (request) => {
    try {
      const r = await request();
      setNotice(r.message);
      await reload();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const remove = (path, question) => {
    if (!window.confirm(question)) return;
    mutate(() => api(path, { method: 'DELETE' }));
  };

  const removeSale = (r) =>
    remove(
      `/stationery/sales/${r.id}`,
      `Delete sale of "${r.item}" on ${r.sale_date}? Any debt payments on it are deleted too.`
    );
  const removeExpense = (r) =>
    remove(`/stationery/expenses/${r.id}`, `Delete expense "${r.description}" on ${r.expense_date}?`);
  const removeStock = (r) =>
    remove(`/stationery/inventory/${r.id}`, `Delete stock record "${r.item}" received on ${r.received_date}?`);

  const saveItemRow = (id, body) => mutate(() => api(`/stationery/items/${id}`, { method: 'PUT', body }));
  const addItem = (body) => {
    setError('');
    return mutate(() => api('/stationery/items', { method: 'POST', body }));
  };

  const quickRanges = [
    { key: 'today', label: 'Today', from: today(), to: today() },
    { key: 'yesterday', label: 'Yesterday', from: daysBack(1), to: daysBack(1) },
    { key: 'week', label: 'Last 7 days', from: daysBack(6), to: today() },
    { key: 'month', label: 'This month', from: monthStart(), to: today() },
  ];

  const navTabs = [
    { key: 'sales', label: 'Sales' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'debtors', label: 'Debtors', badge: debtors.length },
    { key: 'summary', label: 'Summary' },
    ...(isAdmin ? [{ key: 'items', label: 'Items' }] : []),
  ];

  const fabGo = (type) => {
    setFabOpen(false);
    openModal(type);
  };

  return (
    <div className="st-page">
      <div className="cr-page-head">
        <h1 className="h3 mb-1">Stationery</h1>
        <div className="cr-soft">
          Recording as <strong>{user?.full_name || user?.username}</strong>
        </div>
      </div>

      <div className="st-chips">
        {quickRanges.map((r) => (
          <button
            type="button"
            key={r.key}
            className={`st-chip${from === r.from && to === r.to ? ' active' : ''}`}
            onClick={() => {
              setFrom(r.from);
              setTo(r.to);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />

      {!isAdmin && (
        <Alert variant="light" className="border small">
          Every entry is time-stamped and recorded under your account automatically. It cannot be edited or
          deleted after it is saved. Contact the administrator to correct a mistake.
        </Alert>
      )}
      {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-2 g-md-3 mb-2">
        {STATS.map((s) => (
          <Col xs={6} lg={3} key={s.key}>
            <Card className={`cr-stat cr-stat-${s.color}`}>
              <Card.Body className="py-3">
                <div className="cr-stat-label">{s.label}</div>
                <div className="h4 mb-0">{fmt(summary.totals[s.key])}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <div className="text-muted small mb-4">
        Total sales counts money received. A debt is added to the sales of the day it was taken once it is paid.
      </div>

      {!ready ? (
        <div className="text-center py-4"><Spinner animation="border" /></div>
      ) : (
        <Tabs activeKey={tab} onSelect={(k) => setTab(k || 'sales')} variant="pills" className="cr-tabs st-tabs mb-3">
          <Tab eventKey="sales" title="Sales">
            <SalesPanel
              sales={sales}
              inventory={inventory}
              isAdmin={isAdmin}
              onAddSale={() => openModal('sale')}
              onEditSale={(r) => openModal('sale', r)}
              onDeleteSale={removeSale}
              onPay={(r) => openModal('pay', r)}
              onAddStock={() => openModal('stock')}
              onEditStock={(r) => openModal('stock', r)}
              onDeleteStock={removeStock}
            />
          </Tab>

          <Tab eventKey="expenses" title="Expenses">
            <ExpensesPanel
              expenses={expenses}
              isAdmin={isAdmin}
              onAdd={() => openModal('expense')}
              onEdit={(r) => openModal('expense', r)}
              onDelete={removeExpense}
            />
          </Tab>

          <Tab eventKey="debtors" title={`Debtors${debtors.length ? ` (${debtors.length})` : ''}`}>
            <DebtorsPanel debtors={debtors} payments={payments} onPay={(r) => openModal('pay', r)} />
          </Tab>

          <Tab eventKey="summary" title="Daily summary">
            <SummaryPanel days={summary.days} />
          </Tab>

          {isAdmin && (
            <Tab eventKey="items" title="Items and rates">
              <ItemsPanel allItems={allItems} onSaveItem={saveItemRow} onAddItem={addItem} />
            </Tab>
          )}
        </Tabs>
      )}

      {/* ---------------- phone navigation ---------------- */}
      <nav className="st-bottomnav d-md-none">
        {navTabs.map((n) => (
          <button
            type="button"
            key={n.key}
            className={tab === n.key ? 'active' : ''}
            onClick={() => setTab(n.key)}
          >
            {n.label}
            {n.badge > 0 && <span className="st-navbadge">{n.badge}</span>}
          </button>
        ))}
      </nav>

      {fabOpen && <div className="st-fab-scrim d-md-none" onClick={() => setFabOpen(false)} />}
      {fabOpen && (
        <div className="st-fab-menu d-md-none">
          <button type="button" onClick={() => fabGo('stock')}>Add stock</button>
          <button type="button" onClick={() => fabGo('expense')}>Add expense</button>
          <button type="button" onClick={() => fabGo('sale')}>Add sale</button>
        </div>
      )}
      <button
        type="button"
        className="st-fab d-md-none"
        aria-label="Add"
        onClick={() => setFabOpen(!fabOpen)}
      >
        {fabOpen ? '×' : '+'}
      </button>

      {/* ---------------- forms ---------------- */}
      <SaleModal show={modal.type === 'sale'} row={modal.row} items={items} onHide={closeModal} onSaved={saved} />
      <PaymentModal show={modal.type === 'pay'} row={modal.row} onHide={closeModal} onSaved={saved} />
      <ExpenseModal show={modal.type === 'expense'} row={modal.row} onHide={closeModal} onSaved={saved} />
      <StockModal show={modal.type === 'stock'} row={modal.row} onHide={closeModal} onSaved={saved} />
    </div>
  );
}