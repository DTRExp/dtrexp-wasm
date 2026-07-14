/** API surface: instant inputs, zones, diagnostics — the wrapper's own contract. */

// core modules
import assert from 'node:assert/strict';
import { test } from 'node:test';

// own modules
import { DTRExp, DTRExpSyntaxError, parse, SPEC_DRAFT, validate } from '../index.js';

// 2026-07-07 (a Tuesday) 10:00:00Z — inside business hours, in every input shape.
const TUE_10_UTC = 1_783_591_200_000;

test('covers accepts Date, epoch ms, ISO string and Temporal-shaped inputs', () => {
  const expr = parse('T0900:1800 E1:5');
  assert.equal(expr.covers(new Date(TUE_10_UTC)), true);
  assert.equal(expr.covers(TUE_10_UTC), true);
  assert.equal(expr.covers('2026-07-07T10:00:00Z'), true);
  assert.equal(expr.covers({ epochMilliseconds: TUE_10_UTC }), true);
});

test('covers rejects unparsable instants with a TypeError', () => {
  const expr = parse('T0900:1800');
  assert.throws(() => expr.covers('not a date'), TypeError);
  assert.throws(() => expr.covers(Number.NaN), TypeError);
  assert.throws(() => expr.covers(null), TypeError);
});

test('the zone parameter defaults to UTC and accepts an IANA identifier', () => {
  const expr = parse('T0900:1800 E1:5');
  // 07:00Z is 09:00 in Berlin (summer, +2) — covered there, not in UTC.
  const t = '2026-07-07T07:00:00Z';
  assert.equal(expr.covers(t), false);
  assert.equal(expr.covers(t, { tz: 'Europe/Berlin' }), true);
  assert.equal(expr.covers(t, { tz: 'Etc/UTC' }), false);
});

test('an unknown zone throws a RangeError, like Intl everywhere', () => {
  const expr = parse('T0900:1800');
  assert.throws(() => expr.covers(TUE_10_UTC, { tz: 'Not/AZone' }), RangeError);
});

test('parse errors are DTRExpSyntaxError with position and expression', () => {
  try {
    parse('T0900:1800 E9');
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e instanceof DTRExpSyntaxError);
    assert.ok(e instanceof Error);
    assert.equal(e.name, 'DTRExpSyntaxError');
    assert.equal(typeof e.position, 'number');
    assert.equal(e.expression, 'T0900:1800 E9');
    assert.match(e.message, /at position \d+ in 'T0900:1800 E9'/);
  }
});

test('validate mirrors parse: errors make valid false, warnings never do', () => {
  const bad = validate('T25');
  assert.equal(bad.valid, false);
  assert.equal(bad.errors.length, 1);
  assert.equal(typeof bad.errors[0].message, 'string');
  assert.equal(typeof bad.errors[0].position, 'number');
  assert.deepEqual(bad.warnings, []);

  const warned = validate('D30 M2');
  assert.equal(warned.valid, true);
  assert.deepEqual(warned.errors, []);
  assert.ok(warned.warnings.length > 0);
  assert.equal(typeof warned.warnings[0].position, 'number');
});

test('a parsed expression exposes source, frozen warnings and toString', () => {
  const expr = parse('D30 M2');
  assert.ok(expr instanceof DTRExp);
  assert.equal(expr.source, 'D30 M2');
  assert.equal(String(expr), 'D30 M2');
  assert.ok(Object.isFrozen(expr.warnings));
  assert.ok(expr.warnings.length > 0);
});

test('SPEC_DRAFT names the implemented draft', () => {
  assert.equal(SPEC_DRAFT, 2.8);
});
