import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type FileRow } from '../lib/api';
import { formatBytes, formatTime, mimeIcon, DOC_CATEGORIES } from '../lib/format';
import { NotesPanel } from './NotesPanel';

interface Props {
  contactId: string;
}

export function FilesPanel({ contactId }: Props) {
  const qc = useQueryClient();
  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.getContact(contactId),
  });
  const { data: files = [] } = useQuery({
    queryKey: ['files', contactId],
    queryFn: () => api.listFiles(contactId),
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, doc_category }: { id: string; doc_category: string }) =>
      api.patchFile(id, { doc_category }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files', contactId] }),
  });

  const enrich = useMutation({
    mutationFn: () => api.enrichContact(contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact', contactId] }),
  });

  const grouped = useMemo(() => groupByCategory(files), [files]);

  if (!contact) return <aside className="files-panel" />;

  return (
    <aside className="files-panel">
      <div className="fp-header">
        <div className="fp-title">
          {contact.display_name || contact.profile_name || contact.phone_e164}
        </div>
        <div className="fp-id">
          {contact.phone_e164}
          {contact.external_lead_id ? ` · ${contact.external_lead_id}` : ''}
        </div>
        <div className="fp-tags">
          {(contact.tags ?? []).map((t) => (
            <span key={t} className="fp-tag">{t}</span>
          ))}
          {contact.external_app_id && (
            <span className="fp-tag" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              app: {contact.external_app_id}
            </span>
          )}
        </div>
      </div>

      <CustomerDetails
        enrichment={contact.enrichment ?? {}}
        enrichedAt={contact.enriched_at ?? null}
        onRefresh={() => enrich.mutate()}
        refreshing={enrich.isPending}
      />

      <RemindersSection contactId={contactId} />

      <div className="fp-section">Documents · {files.length}</div>

      <div className="fp-list">
        {grouped.map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {DOC_CATEGORIES.find((d) => d.value === cat)?.label ?? cat}
            </div>
            {items.map((f) => (
              <div key={f.id} className="fp-file">
                <div className="icon">{mimeIcon(f.mime_type)}</div>
                <div style={{ minWidth: 0 }}>
                  <a
                    className="name"
                    href={`/api/files/${f.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {f.filename || `file-${f.id.slice(0, 6)}`}
                  </a>
                  <div className="meta">
                    <span>{formatBytes(f.size_bytes)}</span>
                    <span>·</span>
                    <span>{formatTime(f.created_at)}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <select
                      className="cat-select"
                      value={f.doc_category ?? 'unknown'}
                      onChange={(e) =>
                        updateCategory.mutate({ id: f.id, doc_category: e.target.value })
                      }
                    >
                      {DOC_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {files.length === 0 && (
          <div className="empty" style={{ padding: '30px 0', fontSize: 13 }}>
            No documents shared yet
          </div>
        )}
      </div>
      <NotesPanel contactId={contactId} />
    </aside>
  );
}

// Resolve a value by trying each path in turn. Path segments may be object keys
// or numeric array indices (e.g. score_detail.0.value).
function pick(obj: unknown, paths: string[][]): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const path of paths) {
    let cur: unknown = obj;
    let ok = true;
    for (const key of path) {
      if (cur == null) { ok = false; break; }
      if (Array.isArray(cur)) {
        const idx = Number(key);
        if (!Number.isNaN(idx) && idx < cur.length) cur = cur[idx];
        else { ok = false; break; }
      } else if (typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return undefined;
}

// Defensive count: a number is used as-is, an array uses its length.
function asCount(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return undefined;
}

function experianSummary(experian: unknown) {
  // Primary paths are the real Experian (India) bureau_report structure; the
  // rest are defensive fallbacks for other shapes.
  const pd = ['data', 'profile_data'];
  const score = pick(experian, [
    [...pd, 'score_detail', '0', 'value'],
    ['score'], ['credit_score'], ['creditScore'], ['bureau_score'], ['risk_score'],
    ['SCORE'], ['Score', 'value'], ['score', 'value'],
  ]);
  const activeLoans = asCount(pick(experian, [
    [...pd, 'account_summary', 'number_of_active_accounts'],
    ['active_loans'], ['activeLoans'], ['active_accounts'], ['open_accounts'],
    ['summary', 'active_accounts'],
  ]));
  const enquiries = asCount(pick(experian, [
    [...pd, 'enquiry_summary', 'total'],
    ['enquiries'], ['enquiry_count'], ['inquiries'], ['total_enquiries'],
    ['summary', 'enquiries'],
  ]));
  const scoreNum = asCount(score);
  return { score: scoreNum !== undefined ? scoreNum : (score as string | undefined), activeLoans, enquiries };
}

function CustomerDetails({
  enrichment, enrichedAt, onRefresh, refreshing,
}: {
  enrichment: Record<string, unknown>;
  enrichedAt: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const e = enrichment ?? {};
  const paid = e.paid === true ? true : e.paid === false ? false : undefined;
  const pan = e.pan as string | undefined;
  const dob = e.dob as string | undefined;
  const externalId = e.external_id as string | undefined;
  const experian = e.experian;
  const hasExperian = experian && typeof experian === 'object';
  const { score, activeLoans, enquiries } = experianSummary(experian);
  const empty = paid === undefined && !pan && !dob && !hasExperian;

  return (
    <>
      <div className="fp-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Customer details</span>
        <button className="link" onClick={onRefresh} disabled={refreshing} style={{ fontSize: 11 }}>
          {refreshing ? 'Fetching…' : '⟳ Refresh'}
        </button>
      </div>
      <div className="fp-enrich">
        {empty ? (
          <div className="empty" style={{ padding: '10px 0', fontSize: 12 }}>
            No details from the app yet. They arrive automatically when the customer is pushed from kashewapp.in.
          </div>
        ) : (
          <>
            {paid !== undefined && (
              <span className={`pill ${paid ? 'pill-verified' : 'pill-pending'}`} style={{ marginBottom: 8, display: 'inline-block' }}>
                {paid ? '● Paid user' : '○ Not paid'}
              </span>
            )}
            <table className="enrich-table">
              <tbody>
                {pan && (<tr><td className="ek">PAN</td><td className="ev">{pan}</td></tr>)}
                {dob && (<tr><td className="ek">DOB</td><td className="ev">{dob}</td></tr>)}
                {externalId && (<tr><td className="ek">App ID</td><td className="ev">{externalId}</td></tr>)}
              </tbody>
            </table>

            {hasExperian && (
              <>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', margin: '10px 0 6px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Experian
                </div>
                <div className="exp-kpis">
                  <div className="exp-kpi"><div className="exp-v">{score ?? '—'}</div><div className="exp-l">Score</div></div>
                  <div className="exp-kpi"><div className="exp-v">{activeLoans ?? '—'}</div><div className="exp-l">Active loans</div></div>
                  <div className="exp-kpi"><div className="exp-v">{enquiries ?? '—'}</div><div className="exp-l">Enquiries</div></div>
                </div>
                <details className="exp-raw">
                  <summary>Raw report</summary>
                  <pre>{JSON.stringify(experian, null, 2)}</pre>
                </details>
              </>
            )}
          </>
        )}
        {enrichedAt && (
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 6 }}>
            updated {formatTime(enrichedAt)}
          </div>
        )}
      </div>
    </>
  );
}

function RemindersSection({ contactId }: { contactId: string }) {
  const qc = useQueryClient();
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', contactId],
    queryFn: () => api.listContactReminders(contactId),
  });
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['reminders', contactId] });
    qc.invalidateQueries({ queryKey: ['reminders', 'due'] });
  };
  const add = useMutation({
    mutationFn: () => api.addReminder(contactId, new Date(due).toISOString(), note || undefined),
    onSuccess: () => { setDue(''); setNote(''); invalidate(); },
  });
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.updateReminder(id, { done }),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteReminder(id),
    onSuccess: invalidate,
  });

  const now = Date.now();
  return (
    <>
      <div className="fp-section">Follow-ups</div>
      <div className="fp-enrich">
        <div className="rem-add">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="btn primary"
            disabled={!due || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? '…' : 'Add'}
          </button>
        </div>
        <ul className="rem-list">
          {reminders.map((r) => {
            const overdue = !r.done && new Date(r.due_at).getTime() < now;
            return (
              <li key={r.id} className={`rem-item${r.done ? ' done' : ''}${overdue ? ' overdue' : ''}`}>
                <input type="checkbox" checked={r.done} onChange={(e) => toggle.mutate({ id: r.id, done: e.target.checked })} />
                <div className="rem-body">
                  <div className="rem-due">{new Date(r.due_at).toLocaleString()}{overdue ? ' · overdue' : ''}</div>
                  {r.note && <div className="rem-note">{r.note}</div>}
                </div>
                <button className="link" onClick={() => del.mutate(r.id)} title="Delete">✕</button>
              </li>
            );
          })}
          {reminders.length === 0 && (
            <li className="empty" style={{ fontSize: 12, padding: '8px 0', listStyle: 'none' }}>No follow-ups set</li>
          )}
        </ul>
      </div>
    </>
  );
}

function groupByCategory(files: FileRow[]): Array<[string, FileRow[]]> {
  const order = DOC_CATEGORIES.map((c) => c.value);
  const map = new Map<string, FileRow[]>();
  for (const f of files) {
    const k = f.doc_category ?? 'unknown';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(f);
  }
  return [...map.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0])
  );
}
