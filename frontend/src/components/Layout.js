import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { initials } from '../utils';

export default function Layout() {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.full_name || user?.username || '';

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar expand="lg" className="cr-navbar sticky-top">
        <Container>
          <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center gap-2">
            <span className="cr-brand-mark">C</span>
            <span className="lh-1">
              <span className="d-block fw-semibold">Creano</span>
              <small className="d-block text-muted" style={{ fontSize: '0.68rem' }}>
                Financial &amp; IT Services
              </small>
            </span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto ms-lg-4">
              <Nav.Link as={NavLink} to="/" end>Home</Nav.Link>
              {can('bank') && <Nav.Link as={NavLink} to="/bank">Bank</Nav.Link>}
              {can('stationery') && <Nav.Link as={NavLink} to="/stationery">Stationery</Nav.Link>}
              {user?.isAdmin && <Nav.Link as={NavLink} to="/admin">Admin</Nav.Link>}
            </Nav>
            <Nav>
              <NavDropdown
                align="end"
                id="user-menu"
                title={
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="cr-avatar">{initials(name)}</span>
                    <span>{name}</span>
                  </span>
                }
              >
                <NavDropdown.ItemText>
                  <div className="fw-semibold">{name}</div>
                  <div className="small text-muted">
                    {user?.isAdmin ? 'Administrator' : 'Staff'}
                    {user?.phone ? ` | ${user.phone}` : ''}
                  </div>
                </NavDropdown.ItemText>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={signOut}>Log out</NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main className="flex-grow-1">
        <Container className="py-4">
          <Outlet />
        </Container>
      </main>

      <footer className="cr-footer text-center">
        &copy; {new Date().getFullYear()} Creano Financial and IT Services
      </footer>
    </div>
  );
}