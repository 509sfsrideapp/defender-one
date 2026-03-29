const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  st: "St",
  street: "Street",
  ave: "Ave",
  avenue: "Avenue",
  blvd: "Blvd",
  boulevard: "Boulevard",
  rd: "Rd",
  road: "Road",
  dr: "Dr",
  drive: "Drive",
  ln: "Ln",
  lane: "Lane",
  ct: "Ct",
  court: "Court",
  cir: "Cir",
  circle: "Circle",
  pl: "Pl",
  place: "Place",
  ter: "Ter",
  terrace: "Terrace",
  pkwy: "Pkwy",
  parkway: "Parkway",
  hwy: "Hwy",
  highway: "Highway",
  fwy: "Fwy",
  freeway: "Freeway",
  apt: "Apt",
  apartment: "Apartment",
  unit: "Unit",
  bldg: "Bldg",
  suite: "Suite",
  ste: "Ste",
  fl: "Fl",
};

const ALWAYS_UPPERCASE_TOKENS = new Set([
  "afb",
  "usa",
  "usaf",
  "nco",
  "snco",
  "po",
  "pov",
  "pcs",
  "tdy",
  "mwr",
  "dfac",
  "bx",
  "px",
  "nw",
  "ne",
  "sw",
  "se",
  "n",
  "s",
  "e",
  "w",
  "mo",
  "tx",
  "ks",
  "ok",
  "ia",
  "il",
  "ar",
  "ca",
  "co",
  "fl",
  "ga",
  "id",
  "in",
  "ky",
  "la",
  "ma",
  "md",
  "me",
  "mi",
  "mn",
  "ms",
  "mt",
  "nc",
  "nd",
  "ne",
  "nh",
  "nj",
  "nm",
  "nv",
  "ny",
  "oh",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "ut",
  "va",
  "vt",
  "wa",
  "wi",
  "wv",
  "wy",
  "dc",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function capitalizeSimpleWord(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatAlphaNumericToken(token: string) {
  const match = token.match(/^([A-Za-z]+)([-/]?\d.*)$/);

  if (match) {
    return `${match[1].toUpperCase()}${match[2]}`;
  }

  const digitFirstMatch = token.match(/^(\d+)([A-Za-z].*)$/);

  if (digitFirstMatch) {
    return `${digitFirstMatch[1]}${capitalizeSimpleWord(digitFirstMatch[2])}`;
  }

  return token;
}

function formatTokenCore(token: string, abbreviationMap?: Record<string, string>) {
  const lower = token.toLowerCase();

  if (!token) {
    return token;
  }

  if (abbreviationMap?.[lower]) {
    return abbreviationMap[lower];
  }

  if (ALWAYS_UPPERCASE_TOKENS.has(lower)) {
    return lower.toUpperCase();
  }

  if (/^\d+$/.test(token)) {
    return token;
  }

  if (/[A-Za-z]/.test(token) && /\d/.test(token)) {
    return formatAlphaNumericToken(token);
  }

  return capitalizeSimpleWord(token);
}

function formatDelimitedToken(token: string, abbreviationMap?: Record<string, string>): string {
  const apostropheParts = token.split("'");

  return apostropheParts
    .map((apostrophePart) =>
      apostrophePart
        .split("-")
        .map((hyphenPart) =>
          hyphenPart
            .split("/")
            .map((slashPart) => formatTokenCore(slashPart, abbreviationMap))
            .join("/")
        )
        .join("-")
    )
    .join("'");
}

export function formatStructuredText(value: string, options?: { abbreviationMap?: Record<string, string> }) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((token) => formatDelimitedToken(token, options?.abbreviationMap))
    .join(" ");
}

export function formatAddressPart(value: string) {
  return formatStructuredText(value, { abbreviationMap: ADDRESS_ABBREVIATIONS });
}

export function formatStateCode(value: string) {
  return normalizeWhitespace(value).toUpperCase();
}

export function formatVehicleField(value: string) {
  return formatStructuredText(value);
}

export function formatVehiclePlate(value: string) {
  return normalizeWhitespace(value).toUpperCase();
}
