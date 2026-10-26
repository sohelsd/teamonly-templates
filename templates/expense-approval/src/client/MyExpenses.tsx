import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CATEGORIES, CATEGORY_LABELS, type Category, type Expense } from '../shared/types';
import { api } from './api';
import { formatDay, formatMoney, formatWhen, receiptUrl, StatusBadge, today } from './format';

export function MyExpenses() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [description, setDescription] = useState('');
  const [spentOn, setSpentOn] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => api<Expense[]>('/expenses/mine').then(setExpenses, (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setFormError('Add a photo of the receipt.');
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('amount', amount);
      body.append('category', category);
      body.append('description', description);
      body.append('spent_on', spentOn);
      body.append('file', file);
      const row = await api<Expense>('/expenses', { method: 'POST', body });
      setExpenses((list) => [row, ...(list ?? [])]);
      setAmount('');
      setCategory('');
      setDescription('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setNotice('Sent for approval.');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(id: number) {
    if (!confirm('Withdraw this expense?')) return;
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' });
      setExpenses((list) => list?.filter((x) => x.id !== id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const ready = amount.trim() && category && description.trim() && spentOn && file && !saving;
  const waiting = expenses?.filter((x) => x.status === 'pending') ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My expenses</h1>
          <p>Submit what you spent for work. An approver checks it, then finance pays it back.</p>
        </div>
      </div>
      <div className="split">
        <form onSubmit={submit} className="card stack">
          <h2>New expense</h2>
          <div className="row">
            <label>
              Amount
              <input inputMode="decimal" placeholder="42.50" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label>
              Date
              <input type="date" value={spentOn} max={today()} onChange={(e) => setSpentOn(e.target.value)} />
            </label>
          </div>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              <option value="">Choose...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label>
            What was it for?
            <input maxLength={500} placeholder="Taxi from the airport to the client office" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Receipt (photo or PDF)
            <input ref={fileInput} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {formError && <p className="error">{formError}</p>}
          {notice && <p className="ok">{notice}</p>}
          <div><button type="submit" disabled={!ready}>{saving ? 'Sending...' : 'Submit for approval'}</button></div>
        </form>

        <section className="stack">
          <div className="line">
            <h2>Submitted {waiting.length > 0 && <span className="muted small">({waiting.length} waiting)</span>}</h2>
            <button className="secondary small" onClick={load}>Refresh</button>
          </div>
          {error && <p className="error">{error}</p>}
          {expenses === null ? (
            !error && <p className="muted">Loading...</p>
          ) : expenses.length === 0 ? (
            <div className="card empty"><strong>Nothing submitted yet</strong>Your expenses and their status show up here.</div>
          ) : (
            <ul className="list">
              {expenses.map((x) => (
                <li key={x.id} className="card stack" style={{ gap: 6 }}>
                  <div className="line">
                    <strong style={{ fontSize: '1.05rem' }}>{formatMoney(x.amount_cents)}</strong>
                    <StatusBadge status={x.status} />
                  </div>
                  <p>{x.description}</p>
                  <div className="line muted small">
                    <span>
                      {CATEGORY_LABELS[x.category]} · {formatDay(x.spent_on)} · <a href={receiptUrl(x.id)} target="_blank" rel="noreferrer">Receipt</a>
                    </span>
                    {x.status === 'pending' && <button className="ghost small" onClick={() => withdraw(x.id)}>Withdraw</button>}
                  </div>
                  {x.status !== 'pending' && (
                    <p className="small muted">
                      {x.status === 'approved' ? 'Approved' : 'Rejected'} by {x.decided_by_name} on {formatWhen(x.decided_at)}
                      {x.decision_note && <>: "{x.decision_note}"</>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
