export function parsePhone(raw: string | null | undefined): { display: string; tel: string; wa: string } | null {
  if (!raw?.trim()) return null;
  const display = raw.trim();
  const tel = display.replace(/[\s\-().]/g, '');
  const digits = tel.replace(/\D/g, '');
  if (digits.length < 7) return null;
  const wa = tel.replace(/^\+/, '');
  return { display, tel, wa };
}
