import { useEffect, useState } from 'react';
import type { Me } from '../shared/types';
import { api } from './api';
import { CustomerPage } from './CustomerPage';
import { People } from './People';
import { SearchPage } from './SearchPage';
import { Topbar, useRoute } from './shell';
import { UploadPage } from './UploadPage';

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>('/me').then(setMe, () => {});
  }, []);

  const admin = !!me?.roles.includes('admin');
  const one = route.match(/^\/customers\/(\d+)$/);
  const tabs = [
    { href: '#/', label: 'Search', active: route === '/' || !!one },
    ...(admin
      ? [
          { href: '#/upload', label: 'Upload list', active: route === '/upload' },
          { href: '#/people', label: 'People', active: route === '/people' },
        ]
      : []),
  ];

  let page = <SearchPage admin={admin} />;
  if (one) page = <CustomerPage key={one[1]} id={Number(one[1])} me={me} />;
  else if (route === '/upload' && admin) page = <UploadPage />;
  else if (route === '/people' && admin) page = <People owner={me?.owner ?? null} />;

  return (
    <>
      <Topbar title={document.title} tabs={tabs} name={me?.name} />
      {page}
    </>
  );
}
