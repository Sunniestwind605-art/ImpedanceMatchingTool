import assert from "node:assert/strict";

export function assertClose(actual, expected, tolerance = 1e-9, message = "values differ") {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= tolerance * scale,
    `${message}: expected ${expected}, actual ${actual}`,
  );
}

export function assertComplexClose(actual, expected, tolerance = 1e-9, message = "complex values differ") {
  assertClose(actual.re, expected.re, tolerance, `${message} (real)`);
  assertClose(actual.im, expected.im, tolerance, `${message} (imaginary)`);
}
