import { useEffect, useState } from 'react';
import { Alert, Badge, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
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

const ICONS = {
  bank: (
    <Icon>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M3 20h18" />
    </Icon>
  ),
  stationery: (
    <Icon>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </Icon>
  ),
  admin: (
    <Icon>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  ),
};

const DASHBOARDS = [
  {
    key: 'bank',
    title: 'Bank',
    text: 'Records, unsuccessful transactions, debits and credits.',
    to: '/bank',
    tone: 'primary',
  },
  {
    key: 'stationery',
    title: 'Stationery',
    text: 'Sales, expenses and net sales per day.',
    to: '/stationery',
    tone: 'success',
  },
];

const ADMIN_DASHBOARD = {
  key: 'admin',
  title: 'Admin panel',
  text: 'Activity reports by user, dashboard and date, and account approvals.',
  to: '/admin',
  tone: 'dark',
};

export default function Home() {
  const { user, can } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fullName = user?.full_name || user?.username || '';
  const firstName = fullName.split(' ')[0];

  const cards = DASHBOARDS.filter((c) => can(c.key));
  if (user?.isAdmin) cards.push(ADMIN_DASHBOARD);

  return (
    <>
      <div className="cr-page-head">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h1 className="h3 mb-1">
              {greeting}, {firstName}
            </h1>
            <p className="cr-soft mb-2">
              Welcome to Creano Financial and IT Services. Choose a dashboard below to get started.
            </p>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <Badge bg="light" text="dark" className="cr-role">
                {user?.isAdmin ? 'Administrator' : 'Staff'}
              </Badge>
              {user?.phone ? <span className="cr-soft small">Tel: {user.phone}</span> : null}
            </div>
          </div>
          <div className="text-md-end">
            <div className="h3 mb-0">
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="cr-soft small">
              {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {cards.length === 0 ? (
        <Alert variant="info">
          Your account has no dashboards yet. Ask the administrator to assign one.
        </Alert>
      ) : (
        <>
          <h2 className="h5 text-muted mb-3">Your dashboards</h2>
          <Row className="g-3 g-md-4">
            {cards.map((c) => (
              <Col xs={12} md={6} lg={4} key={c.key}>
                <Link to={c.to} className={`cr-tile cr-tile-${c.tone} h-100`}>
                  <span className="cr-tile-icon">{ICONS[c.key]}</span>
                  <span className="cr-tile-body">
                    <span className="cr-tile-title d-block">{c.title}</span>
                    <span className="cr-tile-text d-block">{c.text}</span>
                  </span>
                  <span className="cr-tile-go">
                    <Icon><path d="M9 6l6 6-6 6" /></Icon>
                  </span>
                </Link>
              </Col>
            ))}
          </Row>
        </>
      )}
    </>
  );
}