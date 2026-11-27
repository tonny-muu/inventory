import { Alert, Container, Spinner } from 'react-bootstrap';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function RequireAuth({ children, dashboard }) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (dashboard && !can(dashboard)) {
    return (
      <Container className="py-4">
        <Alert variant="warning">You do not have access to this dashboard.</Alert>
      </Container>
    );
  }
  return children;
}
