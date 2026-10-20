# dtrexp-wasm Changelog

## Unreleased

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
