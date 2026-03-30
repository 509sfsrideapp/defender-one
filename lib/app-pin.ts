export const APP_STARTUP_SESSION_KEY = "defender-one-access-sequence-seen";
export const APP_HOMEPAGE_REVEAL_KEY = "defender-one-homepage-reveal";
export const APP_PIN_LENGTH = 4;

export type StoredAppPinSettings = {
  appPinEnabled?: boolean | null;
  appPinHash?: string | null;
  appPinSalt?: string | null;
};

export function isValidAppPin(pin: string) {
  return /^\d{4}$/.test(pin.trim());
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCryptoApi() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Secure PIN storage is unavailable in this browser.");
  }

  return window.crypto;
}

function generateAppPinSalt() {
  const cryptoApi = getCryptoApi();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return toHex(bytes);
}

async function hashAppPin(pin: string, salt: string) {
  const cryptoApi = getCryptoApi();
  const encoder = new TextEncoder();

  // Store only a salted SHA-256 digest so the launch PIN is never written as plain text.
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    encoder.encode(`${salt}:${pin.trim()}`)
  );

  return toHex(new Uint8Array(digest));
}

export async function createStoredAppPin(pin: string) {
  const normalizedPin = pin.trim();

  if (!isValidAppPin(normalizedPin)) {
    throw new Error("App PIN must be exactly 4 digits.");
  }

  const salt = generateAppPinSalt();
  const hash = await hashAppPin(normalizedPin, salt);

  return {
    salt,
    hash,
  };
}

export async function verifyStoredAppPin(pin: string, salt: string, expectedHash: string) {
  if (!isValidAppPin(pin) || !salt.trim() || !expectedHash.trim()) {
    return false;
  }

  const nextHash = await hashAppPin(pin.trim(), salt.trim());
  return nextHash === expectedHash.trim();
}

export function isStoredAppPinEnabled(settings?: StoredAppPinSettings | null) {
  return Boolean(
    settings?.appPinEnabled &&
      settings.appPinSalt?.trim() &&
      settings.appPinHash?.trim()
  );
}
