export function peakOrderValue(orders) {
  if (orders.length === 0) return 0;
  return Math.max(...orders.map((o) => o.total));
}
