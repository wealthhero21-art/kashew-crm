import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';

export function AgentLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Kashew CRM</div>
        <nav>
          <NavLink to="inbox" className={({ isActive }) => isActive ? 'active' : ''}>Customers</NavLink>
          <NavLink to="reminders" className={({ isActive }) => isActive ? 'active' : ''}>Follow-ups</NavLink>
        </nav>
        <div className="me">
          <div>{user?.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <ThemeToggle />
            <button className="link" onClick={() => { logout(); location.href = '/login'; }}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
