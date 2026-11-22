const LEGACY_ID = /^ORD-\d{6,}$/;

export function isValidOrderId(id) {
  return LEGACY_ID.test(String(id));
}
