export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="cr-auth">
      <div className="cr-auth-hero d-none d-lg-flex">
        <div>
          <div className="cr-brand-mark cr-brand-mark-lg mb-4">C</div>
          <h1 className="display-6 fw-bold mb-3">
            Welcome to Creano Financial and IT Services
          </h1>
          <p className="lead mb-4">
            Record the day's work in one secure place. Every entry is time-stamped
            and saved under your name.
          </p>
          <ul className="list-unstyled cr-hero-points mb-0">
            <li>Stationery sales and daily expenses</li>
            <li>Bank records, debits, credits and unsuccessful transactions</li>
            <li>Clear reports for management</li>
          </ul>
        </div>
      </div>

      <div className="cr-auth-form">
        <div className="w-100" style={{ maxWidth: 430 }}>
          <div className="d-lg-none text-center mb-4">
            <div className="cr-brand-mark cr-brand-mark-lg mx-auto mb-3">C</div>
            <div className="h5 mb-0">Welcome to Creano Financial and IT Services</div>
          </div>

          <div className="card cr-panel">
            <div className="card-body p-4">
              <h2 className="h3 mb-1">{title}</h2>
              <p className="text-muted mb-4">{subtitle}</p>
              {children}
            </div>
          </div>

          <div className="text-center text-muted small mt-4">
            &copy; {new Date().getFullYear()} Creano Financial and IT Services
          </div>
        </div>
      </div>
    </div>
  );
}