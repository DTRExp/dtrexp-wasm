/**
 *  Conformance suite: runs the vendored `vectors.json` (spec §12).
 *  The vectors — not the prose, not this package's docs — are the contract.
 */

// core modules
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// own modules
import { parse, validate } from '../index.js';

const vectors = JSON.parse(await readFile(new URL('./vectors.json', import.meta.url), 'utf8'));

test('coverage: every instant in every group returns the expected boolean', () => {
  let checks = 0;
  for (const group of vectors.coverage) {
    const expr = parse(group.expression);
    for (const [instant, expected] of Object.entries(group.cases)) {
      assert.equal(
        expr.covers(instant, { tz: group.tz }),
        expected,
        `[${group.id}] '${group.expression}' @ ${instant} (${group.tz})`
      );
      checks += 1;
    }
  }
  assert.ok(checks > 0, 'coverage groups ran');
  console.log(`  coverage: ${checks} checks across ${vectors.coverage.length} groups`);
});

test('invalid: every expression is rejected at parse, at the position the vector gives', () => {
  for (const c of vectors.invalid) {
    assert.throws(
      () => parse(c.expression),
      { name: 'DTRExpSyntaxError', position: c.position },
      `'${c.expression}' should be rejected at ${c.position} (${c.reason})`
    );
    const result = validate(c.expression);
    assert.equal(result.valid, false, `validate('${c.expression}') should be invalid`);
    assert.equal(result.errors.length, 1, `validate('${c.expression}') should carry the error`);
    assert.equal(
      result.errors[0].position,
      c.position,
      `validate('${c.expression}') should name position ${c.position}`
    );
  }
});

test('warnings: every expression parses with at least one warning', () => {
  for (const c of vectors.warnings) {
    const expr = parse(c.expression);
    assert.ok(expr.warnings.length > 0, `'${c.expression}' should warn`);
  }
});

test('quiet: every expression parses with zero warnings', () => {
  for (const c of vectors.quiet) {
    const expr = parse(c.expression);
    assert.equal(expr.warnings.length, 0, `'${c.expression}' should be quiet, got ${JSON.stringify(expr.warnings)}`);
  }
});
