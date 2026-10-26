import type { ImportRow } from '../shared/types';

export type ParsedRow = ImportRow & { line: number; problem?: string };

/** Splits pasted spreadsheet text (tab separated from Excel/Sheets, or CSV) into cells. */
function splitRows(text: string): string[][] {
  const delimiter = text.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

type Field = keyof ImportRow;
const MATCHERS: [Field, RegExp][] = [
  ['reorder_level', /reorder|re-order|min(imum)?\b|par/i],
  ['qty', /qty|quantity|on ?hand|count|stock/i],
  ['sku', /sku|item ?(code|no|number|#)|part|code/i],
  ['location', /bin|location|loc\b|shelf|slot|room|site/i],
  ['name', /name|description|desc|item|product/i],
];
const DEFAULT_ORDER: Field[] = ['sku', 'name', 'location', 'qty', 'reorder_level'];

function toNumber(s: string | undefined): number | null {
  const t = (s ?? '').trim().replace(/,/g, '');
  if (t === '') return 0;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function parseSheet(text: string): { rows: ParsedRow[]; columns: Field[]; hasHeader: boolean } {
  const cells = splitRows(text);
  if (cells.length === 0) return { rows: [], columns: DEFAULT_ORDER, hasHeader: false };

  // If the first row looks like headings, use it to find the columns.
  const header = cells[0];
  const columns: (Field | null)[] = header.map(() => null);
  header.forEach((h, i) => {
    const match = MATCHERS.find(([f, re]) => re.test(h) && !columns.includes(f));
    if (match && toNumber(h) === null) columns[i] = match[0];
  });
  const hasHeader = columns.includes('sku') || columns.includes('name');
  const cols = hasHeader ? columns : DEFAULT_ORDER;
  const body = hasHeader ? cells.slice(1) : cells;

  const rows = body.map((r, idx): ParsedRow => {
    const get = (f: Field) => {
      const i = cols.indexOf(f);
      return i >= 0 ? (r[i] ?? '').trim() : '';
    };
    const qty = toNumber(get('qty'));
    const reorder = toNumber(get('reorder_level'));
    const row: ParsedRow = {
      line: idx + (hasHeader ? 2 : 1),
      sku: get('sku'),
      name: get('name'),
      location: get('location'),
      qty: qty ?? 0,
      reorder_level: reorder ?? 0,
    };
    if (!row.sku) row.problem = 'No SKU';
    else if (!row.name) row.problem = 'No name';
    else if (qty === null) row.problem = `Quantity "${get('qty')}" is not a whole number`;
    else if (reorder === null) row.problem = `Reorder level "${get('reorder_level')}" is not a whole number`;
    return row;
  });

  const seen = new Map<string, number>();
  for (const r of rows) {
    if (!r.sku || r.problem) continue;
    const k = r.sku.toLowerCase();
    if (seen.has(k)) r.problem = `Same SKU as line ${seen.get(k)}`;
    else seen.set(k, r.line);
  }
  return { rows, columns: cols.filter((c): c is Field => c !== null), hasHeader };
}
