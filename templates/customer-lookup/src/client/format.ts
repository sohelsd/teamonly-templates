export const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const weekAgo = () => new Date(Date.now() - 7 * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
