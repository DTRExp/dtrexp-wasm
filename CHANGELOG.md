# dtrexp-wasm Changelog

## 1.0.1

- Node.js floor lowered to `>=20.0.0` (was `>=22.0.0`) — the wrapper uses `node:fs/promises`, dynamic import and global `fetch`, nothing newer than Node 18; the conformance suite verified on Node 20.
- npm page fixes: absolute logo URLs (npm doesn't resolve relative image paths), homepage now https://dtrexp.org.

## 1.0.0

- Initial release. Wraps the dtrexp Rust core (spec draft 2.8) with `parse`, `validate`, `covers` and `warnings` per [API.md](https://github.com/DTRExp/dtrexp/blob/main/API.md).
- Passes the full conformance suite: 97 groups, 409 checks.
- Time zones resolve through the host's `Intl` data; no bundled tzdb, ~63 KB wasm.
