# dtrexp-wasm Changelog

## 1.0.0

- Initial release. Wraps the dtrexp Rust core (spec draft 2.8) with `parse`, `validate`, `covers` and `warnings` per [API.md](https://github.com/DTRExp/dtrexp/blob/main/API.md).
- Passes the full conformance suite: 97 groups, 409 checks.
- Time zones resolve through the host's `Intl` data; no bundled tzdb, ~63 KB wasm.
