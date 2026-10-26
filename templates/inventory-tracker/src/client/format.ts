export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
/** Start of today in the browser's timezone, as a UTC instant. */
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().replace(/\.\d+Z$/, 'Z');
};
