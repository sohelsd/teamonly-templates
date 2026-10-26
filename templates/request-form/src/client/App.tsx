import { useCallback, useEffect, useState } from 'react';
import type { Me, QueueCounts } from '../shared/types';
import { api } from './api';
import { MyRequests } from './MyRequests';
import { People } from './People';
import { Queue } from './Queue';
import { RequestPage } from './RequestPage';
import { Topbar, useRoute } from './shell';

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Me>('/me').then(setMe, (e) => setError(e.message));
  }, []);
  const handler = !!me?.roles.includes('handler');
  const refreshCounts = useCallback(() => {
    if (handler) api<{ counts: QueueCounts }>('/queue?status=new').then((r) => setCounts(r.counts), () => {});
  }, [handler]);
  useEffect(refreshCounts, [refreshCounts, route]);

  const one = route.match(/^\/requests\/(\d+)$/);
  const tabs = [
    { href: '#/', label: 'My requests', active: route === '/' },
    ...(handler ? [{ href: '#/queue', label: 'Queue', active: route === '/queue' || !!one, count: counts?.new }] : []),
    ...(me?.roles.includes('admin') ? [{ href: '#/people', label: 'People', active: route === '/people' }] : []),
  ];

  let page = <MyRequests />;
  if (!me) page = <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}</div>;
  else if (one) page = <RequestPage key={one[1]} id={Number(one[1])} handler={handler} onChange={refreshCounts} />;
  else if (route === '/queue' && handler) page = <Queue />;
  else if (route === '/people' && me.roles.includes('admin')) page = <People owner={me.owner} />;

  return (
    <>
      <Topbar title={document.title} tabs={tabs} name={me?.name} />
      {page}
    </>
  );
}
