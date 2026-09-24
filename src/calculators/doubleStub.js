import { add, complex, reciprocal } from "../core/complex.js";
import {
  denormalizeImpedance,
  normalizeImpedance,
  transformNormalizedAdmittance,
  wrapHalfWavelength,
} from "../core/transmissionLine.js";

const TOLERANCE = 1e-12;
const TWO_PI = 2 * Math.PI;

function stubLengths(normalizedSusceptance) {
  const open = wrapHalfWavelength(Math.atan(normalizedSusceptance) / TWO_PI);
  const shorted = Math.abs(normalizedSusceptance) <= TOLERANCE
    ? 0.25
    : wrapHalfWavelength(Math.atan(-1 / normalizedSusceptance) / TWO_PI);
  return {
    openStubLengthWavelengths: open,
    shortedStubLengthWavelengths: shorted,
  };
}

function validateInputs(loadImpedance, characteristicImpedance, spacingWavelengths, firstStubDistanceWavelengths) {
  if (loadImpedance.re <= 0) {
    throw new RangeError("loadImpedance must have positive resistance");
  }
  if (!Number.isFinite(characteristicImpedance) || characteristicImpedance <= 0) {
    throw new RangeError("characteristicImpedance must be a positive finite number");
  }
  if (!Number.isFinite(spacingWavelengths) || spacingWavelengths <= 0 || spacingWavelengths >= 0.5) {
    throw new RangeError("spacingWavelengths must be between 0 and 0.5");
  }
  const angle = TWO_PI * spacingWavelengths;
  if (Math.abs(Math.sin(angle)) <= TOLERANCE || Math.abs(Math.cos(angle)) <= TOLERANCE) {
    throw new RangeError("spacingWavelengths must not be a multiple of a quarter wavelength");
  }
  if (!Number.isFinite(firstStubDistanceWavelengths)) {
    throw new RangeError("firstStubDistanceWavelengths must be finite");
  }
}

/**
 * Calculate two shunt-stub matches. The first stub is placed at the requested
 * distance toward the generator; the second is a fixed spacing farther toward
 * the generator. Stub susceptances are normalized to the main-line admittance.
 */
export function calculateDoubleStub(
  loadImpedance,
  characteristicImpedance,
  spacingWavelengths = 0.125,
  firstStubDistanceWavelengths = 0,
) {
  validateInputs(
    loadImpedance,
    characteristicImpedance,
    spacingWavelengths,
    firstStubDistanceWavelengths,
  );

  const normalizedLoad = normalizeImpedance(loadImpedance, characteristicImpedance);
  const loadAdmittance = reciprocal(normalizedLoad);
  const admittanceAtFirstStub = transformNormalizedAdmittance(
    loadAdmittance,
    firstStubDistanceWavelengths,
  );
  const { re: conductance, im: initialSusceptance } = admittanceAtFirstStub;
  const tangent = Math.tan(TWO_PI * spacingWavelengths);
  const radicand = conductance * (1 + tangent * tangent * (1 - conductance));

  if (radicand < -TOLERANCE) {
    return {
      technique: "double-stub",
      loadImpedance,
      characteristicImpedance,
      spacingWavelengths,
      firstStubDistanceWavelengths: wrapHalfWavelength(firstStubDistanceWavelengths),
      matchable: false,
      reason: "The first-stub conductance lies in the forbidden region for this spacing",
      solutions: [],
    };
  }

  const root = Math.sqrt(Math.max(0, radicand));
  const totalFirstSusceptances = [...new Set([
    (1 + root) / tangent,
    (1 - root) / tangent,
  ].map((value) => value.toFixed(14)))].map(Number);

  const solutions = totalFirstSusceptances.map((totalFirstSusceptance) => {
    const firstStubSusceptance = totalFirstSusceptance - initialSusceptance;
    const afterFirstStub = complex(conductance, totalFirstSusceptance);
    const beforeSecondStub = transformNormalizedAdmittance(afterFirstStub, spacingWavelengths);
    const secondStubSusceptance = -beforeSecondStub.im;
    return {
      firstStubSusceptance,
      secondStubSusceptance,
      admittanceBeforeSecondStub: beforeSecondStub,
      ...Object.fromEntries(
        Object.entries(stubLengths(firstStubSusceptance)).map(([key, value]) => [`first${key[0].toUpperCase()}${key.slice(1)}`, value]),
      ),
      ...Object.fromEntries(
        Object.entries(stubLengths(secondStubSusceptance)).map(([key, value]) => [`second${key[0].toUpperCase()}${key.slice(1)}`, value]),
      ),
    };
  });

  return {
    technique: "double-stub",
    loadImpedance,
    characteristicImpedance,
    spacingWavelengths,
    firstStubDistanceWavelengths: wrapHalfWavelength(firstStubDistanceWavelengths),
    matchable: true,
    solutions,
  };
}

export function evaluateDoubleStub(loadImpedance, characteristicImpedance, result, solution) {
  const normalizedLoad = normalizeImpedance(loadImpedance, characteristicImpedance);
  const atFirstStub = transformNormalizedAdmittance(
    reciprocal(normalizedLoad),
    result.firstStubDistanceWavelengths,
  );
  const afterFirstStub = add(atFirstStub, complex(0, solution.firstStubSusceptance));
  const atSecondStub = transformNormalizedAdmittance(afterFirstStub, result.spacingWavelengths);
  const afterSecondStub = add(atSecondStub, complex(0, solution.secondStubSusceptance));
  return denormalizeImpedance(reciprocal(afterSecondStub), characteristicImpedance);
}
