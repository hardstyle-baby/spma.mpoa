/**
 * excelNormalizer.js
 * Normalises raw Excel cell values into clean DB-ready values.
 * Handles: phone formats, year-only dates, comma-formatted numbers,
 *          slash-separated multi-contacts.
 */

// ── Phone ────────────────────────────────────────────────────
// Strips all spaces, dashes, brackets; keeps leading +
const normalizePhone = (raw) => {
  if (!raw) return null;
  const str = String(raw).trim();
  return str.replace(/[\s\-().]/g, '');
};

// ── Year ─────────────────────────────────────────────────────
// Accepts: 2005, "2005", "2005-01-01", JS Date serial
const normalizeYear = (raw) => {
  if (!raw) return null;

  // Excel date serial (number > 1000 is unlikely to be a year itself only if < 1900)
  if (typeof raw === 'number' && raw > 2200) {
    // Could be an Excel date serial – convert via JS Date
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return d.getFullYear();
  }

  const str = String(raw).trim();

  // "YYYY-MM-DD" or "YYYY/MM/DD"
  const isoMatch = str.match(/^(\d{4})[-\/]/);
  if (isoMatch) return parseInt(isoMatch[1]);

  // Pure year
  const yearMatch = str.match(/^\d{4}$/);
  if (yearMatch) return parseInt(str);

  return null;
};

// ── Number (comma-formatted) ─────────────────────────────────
// "1,234,567.89" → 1234567.89
const normalizeNumber = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  const str = String(raw).replace(/,/g, '').trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
};

// ── Multi-contact split (slash / semicolon / newline) ────────
// "Ali / Abu" → ["Ali", "Abu"]
const splitContacts = (raw) => {
  if (!raw) return [];
  return String(raw)
    .split(/[\/;|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};

// ── Date (DATEONLY) ──────────────────────────────────────────
// Returns ISO string "YYYY-MM-DD" or null
const normalizeDate = (raw) => {
  if (!raw) return null;

  if (typeof raw === 'number') {
    // Excel serial
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }

  const str = String(raw).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

// ── String safe trim ─────────────────────────────────────────
const normalizeString = (raw, maxLength = 255) => {
  if (!raw) return null;
  return String(raw).trim().slice(0, maxLength) || null;
};

module.exports = {
  normalizePhone,
  normalizeYear,
  normalizeNumber,
  splitContacts,
  normalizeDate,
  normalizeString,
};
