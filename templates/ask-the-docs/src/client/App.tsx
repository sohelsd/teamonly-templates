import { useEffect, useState } from 'react';
import type { Features, Me } from '../shared/types';
import { api } from './api';
import { AskPage } from './AskPage';
import { Library } from './Library';
import { People } from './People';
import { Reader } from './Reader';
import { Topbar, useRoute } from './shell';

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  useEffect(() => {
    api<Me>('/me').then(setMe, () => {});
    api<Features>('/features').then(setFeatures, () => {});
  }, []);

  const editor = !!me?.roles.includes('editor');
  const admin = !!me?.roles.includes('admin');
  const [path, query] = route.split('?');
  const doc = path.match(/^\/docs\/(\d+)$/);
  const tabs = [
    { href: '#/', label: features?.answers ? 'Ask' : 'Search', active: path === '/' },
    { href: '#/docs', label: 'Documents', active: path.startsWith('/docs') },
    ...(admin ? [{ href: '#/people', label: 'People', active: path === '/people' }] : []),
  ];

  let page = <AskPage features={features} me={me} />;
  if (doc) page = <Reader key={doc[1]} id={Number(doc[1])} passage={Number(new URLSearchParams(query).get('p')) || null} />;
  else if (path === '/docs') page = <Library editor={editor} />;
  else if (path === '/people' && admin) page = <People owner={me?.owner ?? null} />;

  return (
    <>
      <Topbar title={document.title} tabs={tabs} name={me?.name} />
      {page}
    </>
  );
}
