/**
 *  dtrexp-wasm — DTRExp evaluated by the Rust core, compiled to WebAssembly.
 *  @see https://github.com/DTRExp/dtrexp
 */

/** Structural stand-in for `Temporal.ZonedDateTime` / `Temporal.Instant` — no hard dependency. */
export interface IEpochHolder {
  epochMilliseconds: number;
}

/**
 *  Accepted instant inputs: `Date`, epoch milliseconds, ISO 8601 string, or a Temporal object.
 *  A string must be a real date-time and should name its offset (`Z` or `±hh:mm`); one
 *  without an offset is read in the host's zone.
 */
export type DateInput = Date | number | string | IEpochHolder;

/** Evaluation options — the time zone is always a parameter, never part of the expression. */
export interface IEvalOptions {
  /**
   *  IANA time zone for evaluation: a tz database zone or link name, in any case.
   *  Default (or `null`): the bound `zone`, else `'UTC'`.
   */
  tz?: string | null;
}

/** One positioned diagnostic. */
export interface IIssue {
  message: string;
  /** 0-based offset of the first character of the token or component at fault (spec §8). */
  position?: number;
}

/** Result of `validate()` — non-throwing counterpart of `parse()`. */
export interface IValidationResult {
  valid: boolean;
  errors: IIssue[];
  warnings: IIssue[];
}

/** Thrown by `parse()` for a malformed or statically invalid DTRExp. */
export class DTRExpSyntaxError extends Error {
  /** 0-based offset of the first character of the token at fault (spec §8). */
  readonly position: number;
  /** The offending expression, verbatim. */
  readonly expression: string;
  constructor(message: string, expression: string, position: number);
}

/** A parsed, validated DTRExp — obtain via {@link parse}. */
export class DTRExp {
  /** The source expression, verbatim. */
  readonly source: string;
  /** The spec §9.1 unsatisfiability warnings — same content as `validate(source).warnings`. */
  readonly warnings: readonly IIssue[];
  /** The bound evaluation zone ({@link DTRExp.withZone}) as `Intl` names it, or `undefined`. */
  readonly zone: string | undefined;

  /**
   *  A copy whose evaluation defaults to `tz`; this one is left as it is. A
   *  `{ tz }` passed to a call still wins. Throws `RangeError` at once on a
   *  name that is not a tz database zone or link name (`'+02:00'`, `'PST'`),
   *  and `TypeError` when `tz` is not a string.
   *
   *  @example
   *  const hours = parse('T0900:1800 E1:5').withZone('Europe/Berlin');
   *  hours.covers(new Date()); // evaluated in Berlin
   */
  withZone(tz: string): DTRExp;

  /**
   *  Whether the expression covers the given instant, evaluated in `opts.tz`
   *  (IANA identifier), else the bound `zone`, else `'UTC'`. An unknown zone
   *  throws a `RangeError`, and a string instant that is not a real date-time
   *  (`'2020-02-30T00:00:00Z'`) a `TypeError`.
   *
   *  @example
   *  parse('T0900:1800 E1:5').covers(new Date(), { tz: 'Europe/Berlin' });
   */
  covers(instant: DateInput, opts?: IEvalOptions): boolean;

  /** The source expression (canonical form is not implemented yet). */
  toString(): string;
}

/** Parse and statically validate a DTRExp string; throws {@link DTRExpSyntaxError}. */
export function parse(expression: string): DTRExp;

/** Non-throwing validation: errors make `valid` false; warnings never do. */
export function validate(expression: string): IValidationResult;

/** The DTRExp specification draft this package implements. */
export const SPEC_DRAFT: number;
