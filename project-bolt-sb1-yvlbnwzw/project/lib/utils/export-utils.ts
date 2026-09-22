function escapeCsvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(',');
}

export function toCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  return '﻿' + [toCsvRow(headers), ...rows.map(toCsvRow)].join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
