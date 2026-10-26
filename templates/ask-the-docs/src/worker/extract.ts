// Turns an uploaded file into passages: a few paragraphs each, with the page or heading they came from.
import type { DocKind } from '../shared/types';

export type Piece = { page: number | null; heading: string; body: string };

const TARGET = 900; // characters per passage, roughly two or three paragraphs
const MAX = 1400;

export function kindOf(file: File): DocKind | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (/\.(md|markdown|mdx)$/.test(name) || file.type === 'text/markdown') return 'markdown';
  if (/\.(txt|text|csv|log)$/.test(name) || file.type.startsWith('text/')) return 'text';
  return null;
}

/** Splits text on blank lines and packs paragraphs into passages of about TARGET characters. */
function pack(text: string, page: number | null, heading: string, out: Piece[]) {
  let buf = '';
  const flush = () => {
    if (buf.trim()) out.push({ page, heading, body: buf.trim() });
    buf = '';
  };
  for (let para of text.split(/\n\s*\n/)) {
    para = para.replace(/[ \t]+/g, ' ').trim();
    if (!para) continue;
    // A single huge paragraph is cut at sentence ends.
    while (para.length > MAX) {
      const cut = para.lastIndexOf('. ', MAX) > TARGET / 2 ? para.lastIndexOf('. ', MAX) + 1 : MAX;
      if (buf) flush();
      out.push({ page, heading, body: para.slice(0, cut).trim() });
      para = para.slice(cut).trim();
    }
    if (buf && buf.length + para.length > TARGET) flush();
    buf += (buf ? '\n\n' : '') + para;
  }
  flush();
}

export function fromMarkdown(md: string): { title: string | null; pieces: Piece[] } {
  const pieces: Piece[] = [];
  let title: string | null = null;
  let heading = '';
  let section: string[] = [];
  const end = () => {
    pack(section.join('\n'), null, heading, pieces);
    section = [];
  };
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      end();
      heading = h[2].replace(/[*_`]/g, '');
      if (!title && h[1].length === 1) title = heading;
    } else {
      section.push(line);
    }
  }
  end();
  return { title, pieces };
}

/** Plain text. A short first line followed by a blank line is taken as the title. */
export function fromText(text: string): { title: string | null; pieces: Piece[] } {
  const pieces: Piece[] = [];
  const clean = text.replace(/\r\n?/g, '\n').trim();
  const first = /^([^\n]{1,80})\n\s*\n/.exec(clean);
  pack(clean, null, '', pieces);
  return { title: first ? first[1].trim() : null, pieces };
}

/**
 * Text from each page of a PDF, using unpdf (PDF.js built for Workers). It is loaded only when a PDF
 * is uploaded. Scanned PDFs (pictures of pages) have no text and come back empty.
 */
export async function fromPdf(bytes: ArrayBuffer): Promise<{ title: string | null; pages: number; pieces: Piece[] }> {
  const { extractText, getDocumentProxy, getMeta } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const meta = await getMeta(pdf).catch(() => null);
  const pieces: Piece[] = [];
  text.forEach((pageText, i) => {
    // PDF.js gives one line per text run. A line ending a sentence ends a paragraph; other line breaks are wrapping.
    const cleaned = pageText
      .replace(/\r\n?/g, '\n')
      .replace(/([.!?:])\n/g, '$1\n\n')
      .replace(/([^\n])\n(?!\n)/g, '$1 ');
    pack(cleaned, i + 1, `Page ${i + 1}`, pieces);
  });
  const title = typeof meta?.info?.Title === 'string' && meta.info.Title.trim() ? meta.info.Title.trim() : null;
  return { title, pages: totalPages, pieces };
}
