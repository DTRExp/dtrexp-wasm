# dtrexp-wasm Changelog

## Unreleased

- `SPEC_DRAFT` is `3`. The package implements DTRExp draft 3 and passes its vectors: 110 groups, 451 checks, and every invalid expression rejected at the position the vector gives.
- Fixed an issue where a string instant that is not a real date-time was rolled over to another day: `'2020-02-30T00:00:00Z'` read as March 1, `T24:00` as the next day. It throws `TypeError` now. A string without an offset is still read in the host's zone; 2.0 will reject it.
- Fixed an issue where a local date before year 1 was read as year 1: 1 BCE is year 0 now, as the Rust core reads it.
- Fixed an issue where names `Intl` accepts but the tz database does not were taken as zones: a fixed offset (`'+02:00'`), the `SystemV/…` zones and ICU's three-letter IDs (`'PST'`) throw `RangeError` now. Zone names still match without regard to case. An unknown zone's `RangeError` reads `Unknown time zone: "…"`.
- The draft 3 fixes in the Rust core: error positions name the token at fault (spec §8); an integer above 2,147,483,647 is a syntax error at that integer, and every count up to it evaluates (`Y1:*/10000001` was rejected as too large); `M!*` and year-0000 date literals are syntax errors, and so is a ninth digit after a date literal (`2020010120200102/10D`); `Y!1:9999` warns, and strided year selectors narrow `W53` and `D366` (`W53 Y2021:2022/2` warns).

## 1.1.0

- `withZone(tz)`: a copy of the expression whose evaluation defaults to `tz`, readable as `zone`, so code that evaluates one expression in one zone stops passing `{ tz }` to every call. The original is left as it is; a `{ tz }` passed to a call still wins. An unknown zone throws `RangeError` at once, and a missing one (`undefined`, `null`, not a string) `TypeError` rather than binding the host's zone.
- An empty zone (`{ tz: '' }`) throws `RangeError` instead of evaluating in UTC, as an unknown zone does.
- A parsed expression is frozen, bound or not; code that wrote to an instance throws `TypeError` now (in strict mode, which every ES module is).

## 1.0.2

- Fixed an issue where a bare zone string in the options slot, `covers(t, 'Europe/Berlin')`, was ignored and the call evaluated in UTC. It throws `TypeError` now; pass `{ tz: 'Europe/Berlin' }`.
- Fixed an issue where a `tz` that is not a string crashed the WebAssembly module (`RuntimeError: memory access out of bounds`). It throws `TypeError` now.
- `SPEC_DRAFT` is `2.9`. Core draft 2.9 is byte-identical to 2.8, so behavior is unchanged.

## 1.0.1

- Node.js floor lowered to `>=20.0.0` (was `>=22.0.0`) — the wrapper uses `node:fs/promises`, dynamic import and global `fetch`, nothing newer than Node 18; the conformance suite verified on Node 20.
- npm page fixes: absolute logo URLs (npm doesn't resolve relative image paths), homepage now https://dtrexp.org.

## 1.0.0

- Initial release. Wraps the dtrexp Rust core (spec draft 2.8) with `parse`, `validate`, `covers` and `warnings` per [API.md](https://github.com/DTRExp/dtrexp/blob/main/API.md).
- Passes the full conformance suite: 97 groups, 409 checks.
- Time zones resolve through the host's `Intl` data; no bundled tzdb, ~63 KB wasm.
