import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Reminder } from '../../lib/api';

function bucketOf(due: string): 'overdue' | 'today' | 'upcoming' {
  const d = new Date(due);
  const now = new Date();
  if (d.getTime() < now.getTime()) return 'overdue';
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  return d.getTime() <= endOfToday.getTime() ? 'today' : 'upcoming';
}

export function Reminders() {
  const qc = useQueryClient();
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', 'due'],
    queryFn: () => api.listReminders('open'),
    refetchInterval: 60_000,
  });

  const markDone = useMutation({
    mutationFn: (id: string) => api.updateReminder(id, { done: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  const buckets = useMemo(() => {
    const out: Record<'overdue' | 'today' | 'upcoming', Reminder[]> = { overdue: [], today: [], upcoming: [] };
    for (const r of reminders) out[bucketOf(r.due_at)].push(r);
    return out;
  }, [reminders]);

  const sections: Array<{ key: 'overdue' | 'today' | 'upcoming'; label: string }> = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
  ];

  return (
    <section className="page">
      <header className="page-head"><h1>Follow-ups</h1></header>
      {reminders.length === 0 && (
        <div className="card"><div className="empty" style={{ padding: 30 }}>Nothing due. Add follow-ups from a customer's panel.</div></div>
      )}
      {sections.map(({ key, label }) => buckets[key].length > 0 && (
        <div className="card" key={key}>
          <h3 className={key === 'overdue' ? 'rem-h-overdue' : undefined}>{label} · {buckets[key].length}</h3>
          <ul className="rem-list">
            {buckets[key].map((r) => {
              const name = r.display_name || r.profile_name || r.phone_e164 || 'Customer';
              return (
                <li key={r.id} className={`rem-item${key === 'overdue' ? ' overdue' : ''}`}>
                  <input type="checkbox" checked={false} onChange={() => markDone.mutate(r.id)} title="Mark done" />
                  <div className="rem-body">
                    <div className="rem-due">
                      <Link to={`/agent/inbox?contact=${r.contact_id}`}>{name}</Link>
                      {' · '}{new Date(r.due_at).toLocaleString()}
                    </div>
                    {r.note && <div className="rem-note">{r.note}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
