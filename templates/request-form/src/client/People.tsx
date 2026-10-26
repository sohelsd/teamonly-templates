import { useEffect, useState, type FormEvent } from 'react';
import { ROLES, type Role, type RoleRow } from '../shared/types';
import { api } from './api';

/** Who has which role in the app. Only the owner and admins see this page; the API checks that too. */
export function People({ owner }: { owner: string | null }) {
  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(ROLES[0].id);
  const [error, setError] = useState('');

  useEffect(() => {
    api<RoleRow[]>('/people').then(setRows, (e) => setError(e.message));
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const row = await api<RoleRow>('/people', { method: 'POST', body: JSON.stringify({ email, role }) });
      setRows((r) => [...(r ?? []), row]);
      setEmail('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(r: RoleRow) {
    if (!confirm(`Remove ${r.email} from ${ROLES.find((x) => x.id === r.role)?.plural ?? r.role}?`)) return;
    setError('');
    try {
      await api(`/people/${r.role}/${encodeURIComponent(r.email)}`, { method: 'DELETE' });
      setRows((list) => list?.filter((x) => !(x.email === r.email && x.role === r.role)) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p>{owner ? `${owner} owns this app and can do everything.` : 'The app owner can do everything.'} Add the people who need more than the basics.</p>
        </div>
      </div>

      <form onSubmit={add} className="card stack">
        <h2>Add someone</h2>
        <div className="row">
          <label style={{ flex: '2 1 220px' }}>
            Work email
            <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        </div>
        <p className="muted small">{ROLES.find((r) => r.id === role)?.help}</p>
        {error && <p className="error">{error}</p>}
        <div><button type="submit" disabled={!email.trim()}>Add</button></div>
      </form>

      {rows === null ? (
        !error && <p className="muted">Loading...</p>
      ) : (
        ROLES.map((r) => {
          const people = rows.filter((x) => x.role === r.id);
          return (
            <section key={r.id} className="card">
              <h2>{r.plural}</h2>
              <p className="muted small">{r.help}</p>
              {people.length === 0 ? (
                <p className="muted small" style={{ marginTop: 10 }}>Nobody yet.</p>
              ) : (
                <ul className="divided" style={{ marginTop: 12 }}>
                  {people.map((p) => (
                    <li key={p.email} className="line">
                      <span>{p.email}</span>
                      <button className="ghost small" onClick={() => remove(p)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
