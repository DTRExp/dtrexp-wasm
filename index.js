/**
 *  dtrexp-wasm — DTRExp evaluated by the Rust core, compiled to WebAssembly.
 *  @see https://github.com/DTRExp/dtrexp
 */

// own modules
import initWasm, { parse as wasmParse, registerZoneProvider } from './pkg/dtrexp_wasm.js';

// ---- init: instantiate the wasm binary (Node or browser) -----------------

const wasmUrl = new URL('./pkg/dtrexp_wasm_bg.wasm', import.meta.url);
if (wasmUrl.protocol === 'file:') {
  const { readFile } = await import('node:fs/promises');
  await initWasm({ module_or_path: await readFile(wasmUrl) });
} else {
  await initWasm({ module_or_path: wasmUrl });
}

// ---- the Intl zone provider -----------------------------------------------
// WASM has no zoneinfo filesystem, so the core's time-zone lookups are backed
// by the host's own IANA database through `Intl` — the same technique (and the
// same formatter options) as the reference implementation, dtrexp-js.

const formatters = new Map();

function formatterFor(tz) {
  let fmt = formatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      // without it a year before 1 reads as its BCE number: 1 BCE would be year 1
      era: 'short'
    });
    formatters.set(tz, fmt);
  }
  return fmt;
}

/** Days since 1970-01-01 for a civil date (Hinnant's days_from_civil, pure integers). */
function epochDay(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** UTC offset (seconds east) in effect in `tz` at `instantMs`. */
function offsetAt(tz, instantMs) {
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let bce = false;
  for (const part of formatterFor(tz).formatToParts(instantMs)) {
    switch (part.type) {
      case 'era':
        bce = part.value === 'BC';
        break;
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        hour = Number(part.value);
        break;
      case 'minute':
        minute = Number(part.value);
        break;
      case 'second':
        second = Number(part.value);
        break;
      default:
        break;
    }
  }
  // proleptic ISO years, as the core reads them: 1 BCE is year 0, 2 BCE year -1
  const isoYear = bce ? 1 - year : year;
  const localSec = (epochDay(isoYear, month, day) * 24 + hour) * 3600 + minute * 60 + second;
  return localSec - Math.floor(instantMs / 1000);
}

registerZoneProvider(offsetAt);

// ---- zone identifiers ------------------------------------------------------
// The accepted names are the tz database's zone and link names, matched without
// regard to case (API.md). `Intl` accepts more than that, so what it resolves is
// checked the way the reference implementation checks it.

/**
 *  Names `Intl` accepts that are not tz database zone or link names: ICU's legacy
 *  three-letter IDs, and two names the tz database has since removed. Held upper-case,
 *  since zone names match without regard to case. `SystemV/…` names and fixed offsets
 *  are refused by their shape instead.
 */
const ICU_ONLY_NAMES = new Set([
  'ACT',
  'AET',
  'AGT',
  'ART',
  'AST',
  'BET',
  'BST',
  'CAT',
  'CNT',
  'CST',
  'CTT',
  'EAT',
  'ECT',
  'IET',
  'IST',
  'JST',
  'MIT',
  'NET',
  'NST',
  'PLT',
  'PNT',
  'PRT',
  'PST',
  'SST',
  'VST',
  'CANADA/EAST-SASKATCHEWAN',
  'US/PACIFIC-NEW'
]);

/**
 *  Whether `Intl` resolved `tz` as a tz database zone or link name, not as a fixed
 *  offset (`'+02:00'` resolves to itself) or a name only ICU knows.
 */
function isTzName(tz, resolved) {
  const name = tz.toUpperCase();
  return !/^[+-]/.test(resolved) && !name.startsWith('SYSTEMV/') && !ICU_ONLY_NAMES.has(name);
}

const zoneNames = new Map();
/** Names kept before the cache is cleared; it is keyed on input, which a caller may vary without end. */
const ZONE_NAME_CAP = 4096;

/**
 *  The canonical name of an IANA zone as the platform resolves it (`'utc'`,
 *  `'Etc/UTC'` and `'GMT'` → `'UTC'`; `'europe/berlin'` → `'Europe/Berlin'`).
 *  Throws `RangeError` on anything but a tz database zone or link name: a zone the
 *  platform does not know, a fixed offset (`'+02:00'`), or a name only ICU knows
 *  (`'PST'`, `'SystemV/AST4'`).
 */
function resolveZone(tz) {
  if (tz === 'UTC') return tz;
  let name = zoneNames.get(tz);
  if (name === undefined) {
    try {
      name = new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
    } catch {
      throw new RangeError(`Unknown time zone: "${tz}"`);
    }
    if (!isTzName(tz, name)) throw new RangeError(`Unknown time zone: "${tz}"`);
    if (zoneNames.size >= ZONE_NAME_CAP) zoneNames.clear();
    zoneNames.set(tz, name);
  }
  return name;
}

// ---- the public API --------------------------------------------------------

/** Thrown by `parse()` for a malformed or statically invalid DTRExp. */
export class DTRExpSyntaxError extends Error {
  constructor(message, expression, position) {
    super(`${message} (at position ${position} in '${expression}')`);
    this.name = 'DTRExpSyntaxError';
    /** 0-based offset of the first character of the token at fault (spec §8). */
    this.position = position;
    /** The offending expression, verbatim. */
    this.expression = expression;
  }
}

function toEpochMs(input) {
  if (input instanceof Date) return checkFinite(input.getTime());
  if (typeof input === 'number') return checkFinite(input);
  if (typeof input === 'string') return parseInstant(input);
  if (typeof input === 'object' && input !== null && 'epochMilliseconds' in input) {
    return checkFinite(input.epochMilliseconds);
  }
  throw new TypeError('Expected a Date, epoch milliseconds, ISO 8601 string or Temporal instant');
}

/**
 *  An ISO 8601 date anywhere in the string (`Date.parse` reads `' 2020-02-30'` too), and
 *  its hour. An extended year (`+002021`) matches by its last four digits, which name
 *  the same leap year: years 10,000 apart are 25 whole 400-year cycles apart.
 */
const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}))?/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year, month) {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month === 2 && leap ? 29 : DAYS_IN_MONTH[month - 1];
}

/**
 *  Reads a string instant. `Date.parse` rolls an impossible date over (`2020-02-30` is
 *  March 1, `T24:00` the next day); a string instant must be a real date-time, so
 *  those throw instead. A string without an offset is still read in the host's zone,
 *  as `Date.parse` reads it; 2.0 will reject it.
 */
function parseInstant(input) {
  const ms = checkFinite(Date.parse(input));
  const iso = ISO_DATE.exec(input);
  if (
    iso &&
    (Number(iso[3]) > daysInMonth(Number(iso[1]), Number(iso[2])) || Number(iso[4]) > 23)
  ) {
    throw new TypeError(`Invalid instant: '${input}' is not a real date-time`);
  }
  return ms;
}

/** The zone a call evaluates in: its own `{ tz }`, else the bound zone, else UTC. */
function zoneOf(opts, bound) {
  if (typeof opts === 'string') {
    throw new TypeError(`Pass the time zone as { tz: '${opts}' }`);
  }
  const tz = opts?.tz;
  return tz == null ? (bound ?? 'UTC') : resolveZone(checkZoneName(tz));
}

/** A non-string would reach the module as a bad pointer, and the core reads `''` as UTC. */
function checkZoneName(tz) {
  if (typeof tz !== 'string') {
    throw new TypeError(`Expected a time zone name, got ${tz === null ? 'null' : typeof tz}`);
  }
  if (tz === '') throw new RangeError('A time zone name is required');
  return tz;
}

function checkFinite(ms) {
  if (!Number.isFinite(ms)) throw new TypeError('Invalid instant');
  return ms;
}

/** A parsed, validated DTRExp — obtain via {@link parse}. */
export class DTRExp {
  #inner;

  constructor(inner, source, zone, warnings = Object.freeze(inner.warnings)) {
    this.#inner = inner;
    /** The source expression, verbatim. */
    this.source = source;
    /** The §9.1 unsatisfiability warnings — same content as `validate(source).warnings`. */
    this.warnings = warnings;
    /** The bound evaluation zone ({@link DTRExp#withZone}), or `undefined`. */
    this.zone = zone;
    Object.freeze(this);
  }

  /**
   *  A copy whose evaluation defaults to `tz`, readable as `zone`; this one is
   *  left as it is. A `{ tz }` passed to a call still wins. A name that is not a
   *  tz database zone or link name throws a `RangeError` at once, and one that
   *  is not a string a `TypeError` (`Intl` would read `undefined` as the host's
   *  zone).
   */
  withZone(tz) {
    return new DTRExp(this.#inner, this.source, resolveZone(checkZoneName(tz)), this.warnings);
  }

  /**
   *  Whether the expression covers the given instant, evaluated in `opts.tz`
   *  (IANA identifier), else the bound `zone`, else `'UTC'`. An unknown zone
   *  throws a `RangeError`, and a string instant that is not a real date-time
   *  (`'2020-02-30T00:00:00Z'`) a `TypeError`.
   */
  covers(instant, opts) {
    return this.#inner.covers(toEpochMs(instant), zoneOf(opts, this.zone));
  }

  toString() {
    return this.source;
  }
}

/** Parse and statically validate a DTRExp string; throws {@link DTRExpSyntaxError}. */
export function parse(expression) {
  try {
    return new DTRExp(wasmParse(expression), expression);
  } catch (e) {
    throw new DTRExpSyntaxError(e.message, expression, e.position ?? 0);
  }
}

/** Non-throwing validation: `{ valid, errors, warnings }`, every issue positioned. */
export function validate(expression) {
  try {
    const expr = wasmParse(expression);
    return { valid: true, errors: [], warnings: expr.warnings };
  } catch (e) {
    return {
      valid: false,
      errors: [{ message: e.message, position: e.position ?? 0 }],
      warnings: []
    };
  }
}

/** The DTRExp specification draft this package implements. */
export const SPEC_DRAFT = 3;
