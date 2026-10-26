import { useEffect, useState } from 'react';
import { CATEGORY_LABELS, type MonthReport } from '../shared/types';
import { api } from './api';
import { formatDay, formatMoney, formatWhen, receiptUrl } from './format';

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** The month in the browser's timezone, as UTC instants the API filters on. */
function monthQuery(month: string) {
  const [y, m] = month.split('-').map(Number);
  const from = new Date(y, m - 1, 1).toISOString();
  const to = new Date(y, m, 1).toISOString();
  return new URLSearchParams({ from, to, label: month }).toString();
}

export function Finance() {
  const [month, setMonth] = useState(thisMonth());
  const [report, setReport] = useState<MonthReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setReport(null);
    setError('');
    api<MonthReport>(`/finance?${monthQuery(month)}`).then(setReport, (e) => setError(e.message));
  }, [month]);

  const monthName = new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Finance</h1>
          <p>Everything approved in {monthName}.</p>
        </div>
        <div className="actions">
          <input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} style={{ width: 'auto' }} />
          <a className="button secondary" href={`/api/finance.csv?${monthQuery(month)}`}>Download CSV</a>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {report === null ? (
        !error && <p className="muted">Loading...</p>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><div className="stat-label">Approved</div><div className="stat-value">{formatMoney(report.total_cents)}</div></div>
            <div className="stat"><div className="stat-label">Expenses</div><div className="stat-value">{report.expenses.length}</div></div>
            {report.by_category.slice(0, 3).map((c) => (
              <div key={c.category} className="stat"><div className="stat-label">{CATEGORY_LABELS[c.category]}</div><div className="stat-value">{formatMoney(c.total_cents)}</div></div>
            ))}
          </div>
          {report.expenses.length === 0 ? (
            <div className="card empty"><strong>Nothing approved in {monthName}</strong>Pick another month above.</div>
          ) : (
            <div className="table-wrap">
              <table className="stackable">
                <thead><tr><th>Approved</th><th>Person</th><th>Category</th><th>For</th><th className="num">Amount</th><th>Receipt</th></tr></thead>
                <tbody>
                  {report.expenses.map((x) => (
                    <tr key={x.id}>
                      <td data-label="Approved" className="nowrap">{formatWhen(x.decided_at)}</td>
                      <td data-label="Person">{x.created_by_name}<div className="muted small">{x.created_by}</div></td>
                      <td data-label="Category">{CATEGORY_LABELS[x.category]}</td>
                      <td data-label="For">{x.description}<div className="muted small">Bought {formatDay(x.spent_on)}</div></td>
                      <td data-label="Amount" className="num">{formatMoney(x.amount_cents)}</td>
                      <td data-label="Receipt"><a href={receiptUrl(x.id)} target="_blank" rel="noreferrer">View</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
