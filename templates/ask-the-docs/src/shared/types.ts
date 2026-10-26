// Types shared by the API (src/worker) and the UI (src/client).

export type DocKind = 'pdf' | 'markdown' | 'text';

export type Doc = {
  id: number;
  title: string;
  file_name: string;
  kind: DocKind;
  has_file: number; // 1 when the original file is stored and can be opened
  size_bytes: number;
  pages: number | null;
  passage_count: number;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
};

export type Passage = { id: number; doc_id: number; ord: number; page: number | null; heading: string; body: string };

/** A search hit. `snippet` marks the matching words with \u0002 ... \u0003. */
export type Hit = { passage_id: number; doc_id: number; title: string; kind: DocKind; has_file: number; page: number | null; heading: string; snippet: string };

export type Source = Hit & { n: number };
export type Answer = { answer: string | null; sources: Source[]; hits: Hit[]; error?: string };

export type Features = { answers: boolean };

export const ROLES = [
  { id: 'editor', label: 'Editor', plural: 'Editors', help: 'Upload and remove documents. Everyone can search and ask.' },
  { id: 'admin', label: 'Admin', plural: 'Admins', help: 'Change who has which role on this page.' },
] as const;
export type Role = (typeof ROLES)[number]['id'];
export type RoleRow = { email: string; role: Role; added_by: string; added_at: string };

export type Me = { email: string; name: string; isOwner: boolean; owner: string | null; roles: Role[] };
