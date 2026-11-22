export function peakOrderValue(orders) {
  return Math.max(...orders.map((o) => o.total));
}
