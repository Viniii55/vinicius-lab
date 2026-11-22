const LEGACY_ID = /^ORD-\d{6,}$/;
const UUID_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidOrderId(id) {
  const value = String(id);
  return LEGACY_ID.test(value) || UUID_ID.test(value);
}
