/**
 *  dtrexp-wasm — DTRExp evaluated by the Rust core, compiled to WebAssembly.
 *  @see https://github.com/DTRExp/dtrexp
 */

/** Structural stand-in for `Temporal.ZonedDateTime` / `Temporal.Instant` — no hard dependency. */
export interface IEpochHolder {
  epochMilliseconds: number;
}

/** Accepted instant inputs: `Date`, epoch milliseconds, ISO 8601 string, or a Temporal object. */
export type DateInput = Date | number | string | IEpochHolder;

/** Evaluation options — the time zone is always a parameter, never part of the expression. */
export interface IEvalOptions {
  /** IANA time zone for evaluation. Default: `'UTC'`. */
  tz?: string;
}

/** One positioned diagnostic. */
export interface IIssue {
  message: string;
  /** 0-based character offset into the expression, where known. */
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
  /** 0-based character offset into the expression, where known. */
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

  /**
   *  Whether the expression covers the given instant, evaluated in `opts.tz`
   *  (IANA identifier; default `'UTC'`). An unknown zone throws a `RangeError`.
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
