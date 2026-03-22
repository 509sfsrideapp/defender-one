export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9._-]{3,24}$/.test(normalizeUsername(value));
}

export function looksLikeEmail(value: string) {
  return value.includes("@");
}
