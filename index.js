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
      hourCycle: 'h23'
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
  for (const part of formatterFor(tz).formatToParts(instantMs)) {
    switch (part.type) {
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
  const localSec = (epochDay(year, month, day) * 24 + hour) * 3600 + minute * 60 + second;
  return localSec - Math.floor(instantMs / 1000);
}

registerZoneProvider(offsetAt);

// ---- the public API --------------------------------------------------------

/** Thrown by `parse()` for a malformed or statically invalid DTRExp. */
export class DTRExpSyntaxError extends Error {
  constructor(message, expression, position) {
    super(`${message} (at position ${position} in '${expression}')`);
    this.name = 'DTRExpSyntaxError';
    /** 0-based character offset into the expression, where known. */
    this.position = position;
    /** The offending expression, verbatim. */
    this.expression = expression;
  }
}

function toEpochMs(input) {
  if (input instanceof Date) return checkFinite(input.getTime());
  if (typeof input === 'number') return checkFinite(input);
  if (typeof input === 'string') return checkFinite(Date.parse(input));
  if (typeof input === 'object' && input !== null && 'epochMilliseconds' in input) {
    return checkFinite(input.epochMilliseconds);
  }
  throw new TypeError('Expected a Date, epoch milliseconds, ISO 8601 string or Temporal instant');
}

function checkFinite(ms) {
  if (!Number.isFinite(ms)) throw new TypeError('Invalid instant');
  return ms;
}

/** A parsed, validated DTRExp — obtain via {@link parse}. */
export class DTRExp {
  #inner;

  constructor(inner, source) {
    this.#inner = inner;
    /** The source expression, verbatim. */
    this.source = source;
    /** The §9.1 unsatisfiability warnings — same content as `validate(source).warnings`. */
    this.warnings = Object.freeze(inner.warnings);
  }

  /**
   *  Whether the expression covers the given instant, evaluated in `opts.tz`
   *  (IANA identifier; default `'UTC'`). An unknown zone throws a `RangeError`.
   */
  covers(instant, opts) {
    return this.#inner.covers(toEpochMs(instant), opts?.tz ?? 'UTC');
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
export const SPEC_DRAFT = 2.9;
