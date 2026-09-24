import { add, complex, reciprocal } from "../core/complex.js";
import {
  denormalizeImpedance,
  normalizeImpedance,
  transformNormalizedAdmittance,
  wrapHalfWavelength,
} from "../core/transmissionLine.js";

const TOLERANCE = 1e-12;
const TWO_PI = 2 * Math.PI;

function assertInputs(loadImpedance, characteristicImpedance) {
  if (loadImpedance.re <= 0) {
    throw new RangeError("loadImpedance must have positive resistance");
  }
  if (!Number.isFinite(characteristicImpedance) || characteristicImpedance <= 0) {
    throw new RangeError("characteristicImpedance must be a positive finite number");
  }
}

function tangentRoots(a, b, c) {
  if (Math.abs(a) <= TOLERANCE) {
    const roots = [Number.POSITIVE_INFINITY];
    if (Math.abs(b) > TOLERANCE) roots.push(-c / b);
    return roots;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -TOLERANCE) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)];
}

function tangentToDistance(tangent) {
  if (!Number.isFinite(tangent)) return 0.25;
  return wrapHalfWavelength(Math.atan(tangent) / TWO_PI);
}

function openStubLength(normalizedSusceptance) {
  return wrapHalfWavelength(Math.atan(normalizedSusceptance) / TWO_PI);
}

function shortedStubLength(normalizedSusceptance) {
  if (Math.abs(normalizedSusceptance) <= TOLERANCE) return 0.25;
  return wrapHalfWavelength(Math.atan(-1 / normalizedSusceptance) / TWO_PI);
}

/**
 * Calculate shunt single-stub matches on a lossless line. Distances are toward
 * the generator and all lengths are expressed as fractions of a wavelength.
 */
export function calculateSingleStub(loadImpedance, characteristicImpedance) {
  assertInputs(loadImpedance, characteristicImpedance);
  const normalizedLoad = normalizeImpedance(loadImpedance, characteristicImpedance);
  const loadAdmittance = reciprocal(normalizedLoad);
  const { re: conductance, im: susceptance } = loadAdmittance;

  if (Math.abs(conductance - 1) <= TOLERANCE && Math.abs(susceptance) <= TOLERANCE) {
    return {
      technique: "single-stub",
      loadImpedance,
      characteristicImpedance,
      solutions: [{
        distanceWavelengths: 0,
        normalizedStubSusceptance: 0,
        openStubLengthWavelengths: 0,
        shortedStubLengthWavelengths: 0.25,
      }],
    };
  }

  // Re{(yL + jt)/(1 + jyL t)} = 1, where t = tan(2πd).
  const roots = tangentRoots(
    conductance * conductance + susceptance * susceptance - conductance,
    -2 * susceptance,
    1 - conductance,
  );

  const distances = [...new Set(roots.map(tangentToDistance).map((value) => value.toFixed(14)))]
    .map(Number)
    .sort((a, b) => a - b);

  const solutions = distances.map((distanceWavelengths) => {
    const admittanceAtStub = transformNormalizedAdmittance(
      loadAdmittance,
      distanceWavelengths,
    );
    const normalizedStubSusceptance = -admittanceAtStub.im;
    return {
      distanceWavelengths,
      normalizedStubSusceptance,
      openStubLengthWavelengths: openStubLength(normalizedStubSusceptance),
      shortedStubLengthWavelengths: shortedStubLength(normalizedStubSusceptance),
    };
  });

  return {
    technique: "single-stub",
    loadImpedance,
    characteristicImpedance,
    solutions,
  };
}

export function evaluateSingleStub(loadImpedance, characteristicImpedance, solution) {
  const normalizedLoad = normalizeImpedance(loadImpedance, characteristicImpedance);
  const admittanceAtStub = transformNormalizedAdmittance(
    reciprocal(normalizedLoad),
    solution.distanceWavelengths,
  );
  const matchedAdmittance = add(
    admittanceAtStub,
    complex(0, solution.normalizedStubSusceptance),
  );
  return denormalizeImpedance(reciprocal(matchedAdmittance), characteristicImpedance);
}
