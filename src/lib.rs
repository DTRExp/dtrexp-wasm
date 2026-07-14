//! dtrexp-wasm — the `dtrexp` Rust core compiled to WebAssembly for JS hosts.
//!
//! This layer is deliberately thin: epoch-millisecond instants in, booleans
//! and plain diagnostic objects out. The package entry (`index.js`) owns the
//! ergonomics — `Date`/string instants and the `Intl` zone provider that
//! stands in for the system zoneinfo database WASM lacks.

use std::cell::RefCell;

use dtrexp::{Dtrexp, Tz};
use js_sys::{Array, Function, Object, Reflect};
use wasm_bindgen::prelude::*;

thread_local! {
    /// The host zone provider: `(tzId: string, instantMs: number)` → offset in
    /// seconds east of UTC. Registered once by the package entry at init.
    static PROVIDER: RefCell<Option<Function>> = const { RefCell::new(None) };
}

/// Register the zone provider. The package entry calls this once at module
/// init, before anything can evaluate in a non-UTC zone.
#[wasm_bindgen(js_name = registerZoneProvider)]
pub fn register_zone_provider(f: Function) {
    PROVIDER.with(|p| *p.borrow_mut() = Some(f));
}

/// A `{ message, position }` diagnostic object.
fn issue(pos: usize, message: &str) -> JsValue {
    let o = Object::new();
    // Setting own properties on a fresh object cannot fail.
    Reflect::set(&o, &"message".into(), &message.into()).unwrap();
    Reflect::set(&o, &"position".into(), &(pos as f64).into()).unwrap();
    o.into()
}

/// Parse and statically validate. Throws an `Error` named `DTRExpSyntaxError`
/// carrying `position` and `expression` properties; its `message` is the bare
/// diagnostic (the package entry adds the presentation suffix).
#[wasm_bindgen(js_name = parse)]
pub fn parse(expression: &str) -> Result<Expression, JsValue> {
    match dtrexp::parse(expression) {
        Ok(inner) => Ok(Expression { inner }),
        Err(e) => {
            let err = js_sys::Error::new(&e.message);
            err.set_name("DTRExpSyntaxError");
            Reflect::set(&err, &"position".into(), &(e.pos as f64).into()).unwrap();
            Reflect::set(&err, &"expression".into(), &expression.into()).unwrap();
            Err(err.into())
        }
    }
}

/// A parsed, validated DTRExp (spec draft 2.8).
#[wasm_bindgen]
pub struct Expression {
    inner: Dtrexp,
}

#[wasm_bindgen]
impl Expression {
    /// The §9.1 unsatisfiability warnings: `Array<{ message, position }>`.
    #[wasm_bindgen(getter)]
    pub fn warnings(&self) -> Array {
        self.inner
            .warnings()
            .iter()
            .map(|w| issue(w.pos, &w.message))
            .collect()
    }

    /// Coverage of `instant_ms` evaluated in `tz`; `""`, `"UTC"` and
    /// `"Etc/UTC"` bypass the provider. Any other identifier resolves through
    /// the registered provider, whose first (probing) call doubles as zone
    /// validation — an unknown identifier rethrows the provider's own error.
    pub fn covers(&self, instant_ms: f64, tz: &str) -> Result<bool, JsValue> {
        let instant = instant_ms as i64;
        if tz.is_empty() || tz == "UTC" || tz == "Etc/UTC" {
            return Ok(self.inner.covers_in(instant, &Tz::utc()));
        }
        let provider = PROVIDER
            .with(|p| p.borrow().clone())
            .ok_or_else(|| JsValue::from(js_sys::Error::new("no zone provider registered")))?;
        let id = JsValue::from_str(tz);
        provider.call2(&JsValue::NULL, &id, &instant_ms.into())?;
        let zone = Tz::from_offset_fn(tz, move |t| {
            provider
                .call2(&JsValue::NULL, &id, &(t as f64).into())
                .ok()
                .and_then(|v| v.as_f64())
                // A zone that survived the probe resolves every instant.
                .expect("zone provider failed after a successful probe") as i32
        });
        Ok(self.inner.covers_in(instant, &zone))
    }
}
