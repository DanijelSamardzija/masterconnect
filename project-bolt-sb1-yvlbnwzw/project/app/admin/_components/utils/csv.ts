/**
 * Downloads data as a UTF-8 CSV file (with BOM so Excel opens it correctly).
 * Accepts any array of flat objects; nested values are JSON-stringified.
 */
export function downloadCSV(data: Record<string, unknown>[], filename: string): boolean {
  if (!data.length) return false;

  const headers = Object.keys(data[0]);
  const escape  = (v: unknown): string => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = data.map(row => headers.map(h => escape(row[h])).join(','));
  const csv  = '﻿' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
