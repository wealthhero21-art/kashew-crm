import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../components/Sidebar';

export function AgentLayout() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
