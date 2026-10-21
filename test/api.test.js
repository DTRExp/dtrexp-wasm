/** API surface: instant inputs, zones, diagnostics — the wrapper's own contract. */

// core modules
import assert from 'node:assert/strict';
import { test } from 'node:test';

// own modules
import { DTRExp, DTRExpSyntaxError, parse, SPEC_DRAFT, validate } from '../index.js';

// 2026-07-07 (a Tuesday) 10:00:00Z — inside business hours, in every input shape.
const TUE_10_UTC = 1_783_418_400_000;

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

test('a string instant that is not a real date-time throws instead of rolling over', () => {
  const expr = parse('M3 D1'); // March 1, where Date.parse would roll these over to
  for (const instant of [
    '2020-02-30T00:00:00Z',
    '2021-02-29T00:00:00Z',
    '2020-02-29T24:00:00Z',
    '2020-04-31T12:00:00+02:00'
  ]) {
    assert.throws(() => expr.covers(instant), {
      name: 'TypeError',
      message: `Invalid instant: '${instant}' is not a real date-time`
    });
  }
  // real dates on the month's last day still read
  assert.equal(parse('M2 D29').covers('2020-02-29T23:59:59Z'), true);
  assert.equal(parse('M4 D30').covers('2026-04-30T12:00:00+02:00'), true);
  assert.equal(expr.covers('2020-03-01T00:00:00Z'), true);
});

test('a string instant without an offset is still read in the host zone', () => {
  const expr = parse('T0900:1800');
  const local = '2026-07-07T10:00:00';
  assert.equal(expr.covers(local), expr.covers(new Date(Date.parse(local))));
});

test('a local date before year 1 reads its era: 1 BCE is year 0', () => {
  // 0001-01-01T03:00:00Z is 22:03:58 on Dec 31 of 1 BCE in New York (LMT -4:56:02);
  // year 0 is a leap year, so that is its 366th day.
  const t = '0001-01-01T03:00:00Z';
  const tz = { tz: 'America/New_York' };
  assert.equal(parse('D366 Y*').covers(t, tz), true);
  assert.equal(parse('Y1').covers(t, tz), false);
  assert.equal(parse('M12 D31 T2203:2204').covers(t, tz), true);
});

test('the zone parameter defaults to UTC and accepts an IANA identifier', () => {
  const expr = parse('T0900:1800 E1:5');
  // 07:00Z is 09:00 in Berlin (summer, +2) — covered there, not in UTC.
  const t = '2026-07-07T07:00:00Z';
  assert.equal(expr.covers(t), false);
  assert.equal(expr.covers(t, { tz: 'Europe/Berlin' }), true);
  assert.equal(expr.covers(t, { tz: 'Etc/UTC' }), false);
});

test('a zone passed any way but as a { tz } string throws a TypeError', () => {
  const expr = parse('T0900:1800 E1:5');
  const t = '2026-07-07T07:00:00Z';
  assert.throws(() => expr.covers(t, 'Europe/Berlin'), {
    name: 'TypeError',
    message: "Pass the time zone as { tz: 'Europe/Berlin' }"
  });
  assert.throws(() => expr.covers(t, { tz: 42 }), {
    name: 'TypeError',
    message: 'Expected a time zone name, got number'
  });
  assert.equal(expr.covers(t, { tz: 'Europe/Berlin' }), true); // the module survived
  assert.equal(expr.covers(t, { tz: null }), false); // null is no zone: UTC
});

test('withZone binds a default zone and leaves the original unbound', () => {
  const expr = parse('T0900:1800 E1:5');
  const t = '2026-07-07T07:00:00Z'; // 09:00 in Berlin
  const berlin = expr.withZone('Europe/Berlin');
  assert.notEqual(berlin, expr);
  assert.equal(berlin.zone, 'Europe/Berlin');
  assert.equal(expr.zone, undefined);
  assert.equal(berlin.covers(t), true);
  assert.equal(expr.covers(t), false);
  assert.equal(berlin.covers(t, {}), true);
  assert.equal(berlin.covers(t, { tz: null }), true); // null is no zone: the bound one
  assert.equal(berlin.covers(t, { tz: 'UTC' }), false); // a call's zone wins
  assert.throws(() => berlin.covers(t, { tz: '' }), {
    name: 'RangeError',
    message: 'A time zone name is required'
  }); // not quietly UTC
  assert.equal(expr.withZone('UTC').covers(t, { tz: 'Europe/Berlin' }), true);
  const tokyo = berlin.withZone('Asia/Tokyo'); // 16:00 there
  assert.equal(tokyo.zone, 'Asia/Tokyo');
  assert.equal(tokyo.covers('2026-07-07T09:30:00Z'), false); // 18:30 in Tokyo
  assert.equal(berlin.covers('2026-07-07T09:30:00Z'), true); // 11:30 in Berlin
});

test('withZone keeps the expression itself and stores the zone as Intl names it', () => {
  const expr = parse('D30 M2');
  const bound = expr.withZone('utc');
  assert.equal(bound.zone, 'UTC');
  assert.equal(bound.source, expr.source);
  assert.equal(bound.toString(), expr.toString());
  assert.equal(bound.warnings, expr.warnings);
  assert.equal(expr.withZone('europe/berlin').zone, 'Europe/Berlin');
});

test('withZone refuses an unknown or a missing zone at once', () => {
  const expr = parse('T0900:1800');
  assert.throws(() => expr.withZone('Not/AZone'), RangeError);
  assert.throws(() => expr.withZone(''), RangeError);
  assert.throws(() => expr.withZone(undefined), {
    name: 'TypeError',
    message: 'Expected a time zone name, got undefined'
  });
  assert.throws(() => expr.withZone(null), {
    name: 'TypeError',
    message: 'Expected a time zone name, got null'
  });
});

test('a parsed expression is frozen, bound or not', () => {
  const expr = parse('T0900:1800');
  assert.equal(Object.isFrozen(expr), true);
  assert.equal(Object.isFrozen(expr.withZone('Europe/Berlin')), true);
  assert.throws(() => {
    expr.zone = 'Europe/Berlin';
  }, TypeError);
});

test('an unknown zone throws a RangeError, like Intl everywhere', () => {
  const expr = parse('T0900:1800');
  assert.throws(() => expr.covers(TUE_10_UTC, { tz: 'Not/AZone' }), {
    name: 'RangeError',
    message: 'Unknown time zone: "Not/AZone"'
  });
});

test('a zone is a tz database zone or link name, matched without regard to case', () => {
  const expr = parse('T0900:1800 E1:5');
  const t = '2026-07-07T07:00:00Z'; // 09:00 in Berlin
  for (const tz of ['Europe/Berlin', 'europe/berlin', 'EUROPE/BERLIN', 'Etc/GMT-2', 'etc/gmt-2']) {
    assert.equal(expr.covers(t, { tz }), true, tz);
  }
  assert.equal(expr.covers(t, { tz: 'US/Eastern' }), false); // a link name, 03:00 there
  assert.equal(expr.covers(t, { tz: 'utc' }), false);
  assert.equal(expr.withZone('etc/gmt-2').zone, 'Etc/GMT-2');
});

test('a fixed offset or a name only Intl knows is an unknown zone', () => {
  const expr = parse('T0900:1800');
  for (const tz of ['+02:00', '-05:00', '+0200', 'SystemV/AST4', 'systemv/est5edt', 'PST', 'ist']) {
    assert.throws(() => expr.covers(TUE_10_UTC, { tz }), {
      name: 'RangeError',
      message: `Unknown time zone: "${tz}"`
    });
    assert.throws(() => expr.withZone(tz), RangeError, tz);
  }
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

test('counts up to the integer limit evaluate without trapping the module', () => {
  assert.equal(parse('Y1:*/2147483647').covers('0001-06-01T00:00:00Z'), true);
  const long = parse('20200101/2147483647Y/2147483646Y');
  assert.equal(long.covers('2019-12-31T23:00:00Z'), false);
  assert.equal(long.covers('9999-12-31T23:00:00Z', { tz: 'Europe/Berlin' }), true);
  assert.throws(() => parse('Y1:*/2147483648'), { name: 'DTRExpSyntaxError', position: 5 });
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
  assert.equal(SPEC_DRAFT, 3);
});
