import { useEffect, useState, type ReactNode } from 'react';

/** The part of the address after #, like "/items/12". Hash routes work on every host with no server setup. */
export function useRoute(): string {
  const read = () => location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export type Tab = { href: string; label: string; active: boolean; count?: number };

export function Topbar({ title, tabs, name }: { title: string; tabs: Tab[]; name?: string }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a href="#/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {title}
        </a>
        <nav className="tabs" aria-label="Sections">
          {tabs.map((t) => (
            <a key={t.href} href={t.href} className={t.active ? 'active' : ''} aria-current={t.active ? 'page' : undefined}>
              {t.label}
              {!!t.count && <span className="count">{t.count}</span>}
            </a>
          ))}
        </nav>
        <div className="who">
          {name && <span className="who-name">{name}</span>}
          <a href="/__teamonly/logout">Sign out</a>
        </div>
      </div>
    </header>
  );
}

export function Loading({ what = 'Loading...' }: { what?: string }) {
  return <p className="muted">{what}</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
