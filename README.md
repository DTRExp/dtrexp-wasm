<p align="center"><img src="https://raw.githubusercontent.com/DTRExp/dtrexp-wasm/main/.github/logo.svg" width="200" alt="dtrexp-wasm" /></p>

# dtrexp-wasm

<p align="center">
  <a href="https://www.npmjs.com/package/dtrexp-wasm"><img src="https://img.shields.io/npm/v/dtrexp-wasm?style=flat&label=&logo=npm&color=C6234B" alt="npm" /></a>
  <img src="https://img.shields.io/badge/conformance-409%2F409-2BB150?style=flat" alt="conformance 409/409" />
  <img src="https://img.shields.io/badge/wasm-~63%20KB-654FF0?style=flat" alt="wasm ~63 KB" />
  <a href="https://gist.github.com/onury/d3f3d765d7db2e8b2d050d14315f2ac7"><img src="https://img.shields.io/badge/ESM-F7DF1E?style=flat" alt="ESM" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="MIT license" /></a>
</p>

> This module is **ESM** 🔆. Please [**read this**](https://gist.github.com/onury/d3f3d765d7db2e8b2d050d14315f2ac7).

**[DTRExp](https://github.com/DTRExp/dtrexp)** (read: "**DTR Expression**") evaluated by the [Rust core][rs], compiled to WebAssembly for JS hosts: browsers, Node, Deno and Bun (edge runtimes with WebAssembly support are untested).

```
T0900:1800 E1:5          Mon–Fri, 09:00–18:00
E7#-1 M4                 last Sunday of April, every year
20200106/10D             every 10 days from 2020-01-06 (cron can't say this)
D13 E5                   every Friday the 13th (cron can't say this either)
```

Note that for most JS applications the reference implementation, **[dtrexp][js]**, is the right pick; it is pure TypeScript, zero-dependency, and implements the full Tier-2 API (`next()`, `describe()`, `toRRule()`…). This package exists for a different job: running the **Rust** evaluator itself in a JS host. Use it when your backend already standardizes on [dtrexp-rs][rs] and you want the same binary logic in the browser, or for cross-implementation parity checks against the reference.

## Install

```sh
npm i dtrexp-wasm
```

The wasm binary (~63 KB, ~29 KB gzipped) ships inside the package and instantiates at import; no fetch configuration, no separate asset step.

## Usage

```js
import { parse, validate } from 'dtrexp-wasm';

const dtr = parse('T0900:1800 E1:5'); // business hours
dtr.covers(new Date(), { tz: 'Europe/Berlin' }); // —> true
dtr.covers('2026-07-11T10:00:00Z'); // —> false (a Saturday, evaluated in UTC)

const store = dtr.withZone('Europe/Berlin'); // the zone, bound once
store.covers(new Date()); // evaluated in Berlin

validate('D30 M2');
// —> { valid: true, errors: [], warnings: [{ message: '…unsatisfiable…', position: 0 }] }
```

The operation vocabulary is fixed across every DTRExp implementation ([API.md][api]); if you know one library, you know this one.

## API

### `parse(expression)`

- *expression* `String` — Required. The DTRExp source text.

**returns** a `DTRExp` instance.

Fails with a positioned `DTRExpSyntaxError` (`position`, `expression` properties) on invalid input. Parse failure is the only failure; a syntactically valid expression never fails later.

### `validate(expression)`

- *expression* `String` — Required. The DTRExp source text.

**returns** `{ valid, errors, warnings }`; every issue carries a `message` and a 0-based `position`. An expression can be valid **and** warned; that is the point of the distinction.

### `DTRExp#covers(instant [, opts])`

- *instant* `Date | number | string | { epochMilliseconds }` — Required. The instant to test.
- *opts.tz* `String` — Optional. An IANA time-zone identifier (e.g. `"Europe/Berlin"`). Default: the bound `zone` (`withZone()`), else **`"UTC"`**.

**returns** `Boolean`.

An unknown zone throws a `RangeError`; exactly what `Intl` itself throws for one. So does an empty one. A zone passed any other way than as a `{ tz }` string throws a `TypeError` (`covers(t, 'Europe/Berlin')` included); `null` means no zone: the bound one, else UTC.

### `DTRExp#withZone(tz)`

- *tz* `String` — Required. An IANA time-zone identifier.

**returns** a copy of the expression whose evaluation defaults to `tz`; the original is left as it is, and the copy's `source` and `warnings` are the same. A `{ tz }` passed to a call still wins. An unknown zone throws a `RangeError` at once, and one that is not a string a `TypeError`.

### `DTRExp#zone`

The bound zone as `Intl` names it (`'utc'` → `'UTC'`, `'europe/berlin'` → `'Europe/Berlin'`), or `undefined` when none is bound. A parsed expression is frozen, bound or not.

**Which to use:** bind the zone with `withZone()` when it belongs to what the expression describes (a store's hours, a venue's schedule), and pass `{ tz }` per call when it belongs to whoever is asking (a rule shown to each user in their own zone). A bound copy shares its `source` with the original, so a cache of parsed expressions keys on `source` and `zone` together.

### `DTRExp#warnings`

The spec §9.1 unsatisfiability warnings of a parsed expression; same content as `validate(source).warnings`, exposed on the instance so code that parses directly doesn't lose them.

## Time Zones

WebAssembly has no zoneinfo filesystem, so this package does not ship a time-zone database. Zone lookups are answered by the host's own IANA data through `Intl.DateTimeFormat` — the same technique the reference implementation uses — which keeps the binary small and the zone data exactly as current as the runtime's. `UTC` (the default) never touches the bridge and evaluates entirely inside the wasm module.

## Conformance

The spec's test vectors are the contract ([spec §12][spec-conformance]); this package vendors `vectors.json` and runs all of it in its test suite — 97 groups, 409 checks, including the coverage groups evaluated through the `Intl` zone bridge.

## Related Projects

- [**dtrexp** (spec)][spec] — the DTRExp specification (grammar, semantics, conformance vectors) this package implements.
- [**dtrexp-rs**][rs] — the Rust core this package compiles to WebAssembly.
- [**dtrexp-js**][js] — the reference implementation; the pure-TypeScript alternative on npm.
- [**dtrexp-py**][py] · [**dtrexp-go**][go] · [**dtrexp-swift**][swift] · [**dtrexp-java**][java] — the other implementations; same core interface.

## License

MIT — © 2026, Onur Yıldırım.

[js]: https://github.com/DTRExp/dtrexp-js
[rs]: https://github.com/DTRExp/dtrexp-rs
[api]: https://github.com/DTRExp/dtrexp/blob/main/API.md
[spec-conformance]: https://github.com/DTRExp/dtrexp/blob/main/spec.md#12-conformance
[spec]: https://github.com/DTRExp/dtrexp
[py]: https://github.com/DTRExp/dtrexp-py
[go]: https://github.com/DTRExp/dtrexp-go
[swift]: https://github.com/DTRExp/dtrexp-swift
[java]: https://github.com/DTRExp/dtrexp-java
