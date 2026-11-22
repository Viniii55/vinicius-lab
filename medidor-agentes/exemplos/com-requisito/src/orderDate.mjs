const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;

export function parseOrderDate(dateStr) {
  const input = String(dateStr);
  if (!ISO_PATTERN.test(input)) {
    throw new Error(`invalid order date: ${input}`);
  }
  const date = new Date(input.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid order date: ${input}`);
  }
  return date;
}
