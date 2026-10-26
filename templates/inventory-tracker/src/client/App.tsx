import { useEffect, useState } from 'react';
import type { Me } from '../shared/types';
import { api } from './api';
import { HistoryPage } from './HistoryPage';
import { ImportPage } from './ImportPage';
import { ItemPage } from './ItemPage';
import { LookupPage } from './LookupPage';
import { LowStockPage } from './LowStockPage';
import { NewItemPage } from './NewItemPage';
import { People } from './People';
import { Topbar, useRoute } from './shell';

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [low, setLow] = useState(0);
  useEffect(() => {
    api<Me>('/me').then(setMe, () => {});
  }, []);
  useEffect(() => {
    api<{ id: number }[]>('/items/low').then((r) => setLow(r.length), () => {});
  }, [route]);

  const admin = !!me?.roles.includes('admin');
  const item = route.match(/^\/items\/(\d+)$/);
  const tabs = [
    { href: '#/', label: 'Items', active: route === '/' || !!item || route === '/new' },
    { href: '#/low', label: 'Low stock', active: route === '/low', count: low },
    { href: '#/history', label: 'History', active: route === '/history' },
    ...(admin
      ? [
          { href: '#/import', label: 'Import', active: route === '/import' },
          { href: '#/people', label: 'People', active: route === '/people' },
        ]
      : []),
  ];

  let page = <LookupPage />;
  if (item) page = <ItemPage key={item[1]} id={Number(item[1])} admin={admin} />;
  else if (route === '/low') page = <LowStockPage />;
  else if (route === '/history') page = <HistoryPage />;
  else if (route === '/new') page = <NewItemPage />;
  else if (route === '/import' && admin) page = <ImportPage />;
  else if (route === '/people' && admin) page = <People owner={me?.owner ?? null} />;

  return (
    <>
      <Topbar title={document.title} tabs={tabs} name={me?.name} />
      {page}
    </>
  );
}
