import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from './ThemeToggle';

// Single left-hand navigation used across the whole app. The Chat group holds
// the day-to-day customer work; the Manage group holds the back-office views.
const groups = [
  {
    title: 'Chat',
    items: [
      { to: '/agent/inbox', label: 'Chats' },
      { to: '/agent/reminders', label: 'Follow-ups' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { to: '/admin/leads', label: 'Leads' },
      { to: '/admin/users', label: 'Users' },
      { to: '/admin/sources', label: 'Sources' },
      { to: '/admin/stats', label: 'Stats' },
      { to: '/admin/audit', label: 'Audit' },
    ],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="side">
      <div className="brand">Kashew CRM</div>
      <nav>
        {groups.map((g) => (
          <div key={g.title} className="nav-group">
            <div className="nav-group-title">{g.title}</div>
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {it.label}
              </NavLink>
            ))}
          </div>
        ))}
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
  );
}
