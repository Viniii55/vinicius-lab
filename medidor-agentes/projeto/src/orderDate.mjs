export function parseOrderDate(dateStr) {
  const parts = String(dateStr).split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[3]);
  return new Date(Date.UTC(year, month - 1, day));
}
