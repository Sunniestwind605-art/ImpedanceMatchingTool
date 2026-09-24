const EPSILON = 1e-15;

export function complex(re, im = 0) {
  if (!Number.isFinite(re) || !Number.isFinite(im)) {
    throw new RangeError("Complex components must be finite numbers");
  }
  return { re, im };
}

export function add(a, b) {
  return complex(a.re + b.re, a.im + b.im);
}

export function subtract(a, b) {
  return complex(a.re - b.re, a.im - b.im);
}

export function multiply(a, b) {
  return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

export function divide(a, b) {
  const denominator = b.re * b.re + b.im * b.im;
  if (denominator <= EPSILON) {
    throw new RangeError("Cannot divide by zero impedance");
  }
  return complex(
    (a.re * b.re + a.im * b.im) / denominator,
    (a.im * b.re - a.re * b.im) / denominator,
  );
}

export function reciprocal(value) {
  return divide(complex(1), value);
}

export function magnitude(value) {
  return Math.hypot(value.re, value.im);
}

export function phase(value) {
  return Math.atan2(value.im, value.re);
}

export function scale(value, factor) {
  return complex(value.re * factor, value.im * factor);
}
