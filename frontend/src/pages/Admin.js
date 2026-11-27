import { Tab, Tabs } from 'react-bootstrap';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AdminActivity from '../components/AdminActivity';
import AdminUsers from '../components/AdminUsers';

export default function Admin() {
  const { user } = useAuth();

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <div className="cr-page-head">
        <h1 className="h3 mb-1">Admin panel</h1>
        <div className="cr-soft">
          See who signed in, when, and what each person recorded, then manage who can use the system.
        </div>
      </div>

      <Tabs defaultActiveKey="activity" variant="pills" className="cr-tabs mb-4" mountOnEnter unmountOnExit>
        <Tab eventKey="activity" title="Activity reports">
          <AdminActivity />
        </Tab>
        <Tab eventKey="users" title="Users and access">
          <AdminUsers />
        </Tab>
      </Tabs>
    </>
  );
}