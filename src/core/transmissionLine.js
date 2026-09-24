import {
  add,
  complex,
  divide,
  magnitude,
  multiply,
  reciprocal,
  scale,
  subtract,
} from "./complex.js";

const TWO_PI = 2 * Math.PI;

function assertPositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

export function normalizeImpedance(impedance, characteristicImpedance) {
  assertPositiveFinite(characteristicImpedance, "characteristicImpedance");
  return scale(impedance, 1 / characteristicImpedance);
}

export function denormalizeImpedance(normalizedImpedance, characteristicImpedance) {
  assertPositiveFinite(characteristicImpedance, "characteristicImpedance");
  return scale(normalizedImpedance, characteristicImpedance);
}

export function impedanceToAdmittance(impedance) {
  return reciprocal(impedance);
}

export function reflectionCoefficient(normalizedImpedance) {
  return divide(
    subtract(normalizedImpedance, complex(1)),
    add(normalizedImpedance, complex(1)),
  );
}

export function impedanceFromReflection(reflection) {
  if (magnitude(reflection) >= 1) {
    throw new RangeError("Passive finite impedance requires |reflection| < 1");
  }
  return divide(add(complex(1), reflection), subtract(complex(1), reflection));
}

export function transformNormalizedImpedance(normalizedLoad, distanceWavelengths) {
  if (!Number.isFinite(distanceWavelengths)) {
    throw new RangeError("distanceWavelengths must be finite");
  }
  const tangent = Math.tan(TWO_PI * distanceWavelengths);
  const jt = complex(0, tangent);
  return divide(
    add(normalizedLoad, jt),
    add(complex(1), multiply(jt, normalizedLoad)),
  );
}

export function transformNormalizedAdmittance(normalizedLoadAdmittance, distanceWavelengths) {
  return reciprocal(
    transformNormalizedImpedance(reciprocal(normalizedLoadAdmittance), distanceWavelengths),
  );
}

export function wrapHalfWavelength(distanceWavelengths) {
  const wrapped = ((distanceWavelengths % 0.5) + 0.5) % 0.5;
  return Math.abs(wrapped - 0.5) < 1e-12 ? 0 : wrapped;
}
