import { useCallback, useEffect, useState } from 'react';
import type { Expense, Me } from '../shared/types';
import { api } from './api';
import { Approvals } from './Approvals';
import { Finance } from './Finance';
import { MyExpenses } from './MyExpenses';
import { People } from './People';
import { Topbar, useRoute } from './shell';

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [error, setError] = useState('');

  const can = (r: Me['roles'][number]) => !!me?.roles.includes(r);

  // The badge on the Approvals tab: expenses other people are waiting on.
  const refreshCount = useCallback(() => {
    if (!me?.roles.includes('approver')) return;
    api<Expense[]>('/approvals').then((list) => setWaiting(list.filter((x) => x.created_by !== me.email).length), () => {});
  }, [me]);

  useEffect(() => {
    api<Me>('/me').then(setMe, (e) => setError(e.message));
  }, []);
  useEffect(refreshCount, [refreshCount, route]);

  const tabs = [
    { href: '#/', label: 'My expenses', active: route === '/', show: true },
    { href: '#/approvals', label: 'Approvals', active: route === '/approvals', show: can('approver'), count: waiting },
    { href: '#/finance', label: 'Finance', active: route === '/finance', show: can('finance') },
    { href: '#/people', label: 'People', active: route === '/people', show: can('admin') },
  ].filter((t) => t.show);

  let page = <MyExpenses />;
  if (!me) page = <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}</div>;
  else if (route === '/approvals' && can('approver')) page = <Approvals me={me} onDecided={refreshCount} />;
  else if (route === '/finance' && can('finance')) page = <Finance />;
  else if (route === '/people' && can('admin')) page = <People owner={me.owner} />;

  return (
    <>
      <Topbar title={document.title} tabs={tabs} name={me?.name} />
      {page}
    </>
  );
}
