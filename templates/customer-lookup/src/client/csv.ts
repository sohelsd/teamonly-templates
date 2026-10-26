import type { CustomerInput } from '../shared/types';

// Small RFC 4180 CSV parser: quoted fields, commas and line breaks inside quotes, "" escapes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

type Field = keyof CustomerInput;

// Header names we recognise for each field (compared lowercase, letters only).
const ALIASES: Record<Field, string[]> = {
  account_number: ['accountnumber', 'accountno', 'account', 'accountid', 'customerid', 'customernumber', 'customerno', 'id', 'number', 'acct', 'acctno'],
  name: ['name', 'customername', 'fullname', 'contactname', 'contact'],
  company: ['company', 'companyname', 'organization', 'organisation', 'accountname', 'business'],
  email: ['email', 'emailaddress', 'mail', 'customeremail', 'contactemail'],
  phone: ['phone', 'phonenumber', 'telephone', 'tel', 'mobile', 'phoneno'],
  plan: ['plan', 'planname', 'subscription', 'subscriptionplan', 'tier', 'product'],
  account_manager: ['accountmanager', 'am', 'manager', 'accountowner', 'owner', 'csm', 'accountexec'],
  customer_since: ['customersince', 'since', 'signupdate', 'signup', 'signedup', 'signupon', 'createdat', 'created', 'startdate', 'joined', 'datesignedup'],
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

export function mapHeaders(header: string[]): { map: Partial<Record<Field, number>>; missing: Field[] } {
  const map: Partial<Record<Field, number>> = {};
  const keys = header.map(norm);
  for (const field of Object.keys(ALIASES) as Field[]) {
    const idx = keys.findIndex((k) => ALIASES[field].includes(k));
    if (idx >= 0) map[field] = idx;
  }
  const missing = (Object.keys(ALIASES) as Field[]).filter((f) => map[f] === undefined);
  return { map, missing };
}

function normalizeDate(s: string): string {
  const v = s.trim();
  if (!v) return '';
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toCustomers(rows: string[][], map: Partial<Record<Field, number>>): CustomerInput[] {
  const get = (r: string[], f: Field) => (map[f] === undefined ? '' : (r[map[f]!] ?? '').trim());
  return rows.map((r) => ({
    account_number: get(r, 'account_number'),
    name: get(r, 'name'),
    company: get(r, 'company'),
    email: get(r, 'email').toLowerCase(),
    phone: get(r, 'phone'),
    plan: get(r, 'plan'),
    account_manager: get(r, 'account_manager'),
    customer_since: normalizeDate(get(r, 'customer_since')),
  }));
}
