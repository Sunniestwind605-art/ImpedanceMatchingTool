import { complex, magnitude, phase, reciprocal, scale } from "../core/complex.js";
import {
  denormalizeImpedance,
  normalizeImpedance,
  reflectionCoefficient,
  transformNormalizedImpedance,
  wrapHalfWavelength,
} from "../core/transmissionLine.js";

const TOLERANCE = 1e-12;
const TWO_PI = 2 * Math.PI;
const FOUR_PI = 4 * Math.PI;

function validateInputs(loadImpedance, characteristicImpedance) {
  if (loadImpedance.re <= 0) {
    throw new RangeError("loadImpedance must have positive resistance");
  }
  if (!Number.isFinite(characteristicImpedance) || characteristicImpedance <= 0) {
    throw new RangeError("characteristicImpedance must be a positive finite number");
  }
}

function wrapTwoPi(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function solutionAtDistance(normalizedLoad, characteristicImpedance, distanceWavelengths) {
  const impedanceAtTransformer = denormalizeImpedance(
    transformNormalizedImpedance(normalizedLoad, distanceWavelengths),
    characteristicImpedance,
  );
  if (Math.abs(impedanceAtTransformer.im) > 1e-8 * characteristicImpedance) {
    throw new Error("Internal error: quarter-wave placement did not reach a real impedance");
  }
  return {
    placementDistanceWavelengths: wrapHalfWavelength(distanceWavelengths),
    transformerLengthWavelengths: 0.25,
    terminationResistanceOhms: impedanceAtTransformer.re,
    transformerImpedanceOhms: Math.sqrt(
      characteristicImpedance * impedanceAtTransformer.re,
    ),
  };
}

/**
 * Calculate a single-section quarter-wave transformer. For a complex load, a
 * length of the existing Z0 line is included to reach each real-axis crossing.
 */
export function calculateQuarterWave(loadImpedance, characteristicImpedance) {
  validateInputs(loadImpedance, characteristicImpedance);
  const normalizedLoad = normalizeImpedance(loadImpedance, characteristicImpedance);
  const reflection = reflectionCoefficient(normalizedLoad);

  if (magnitude(reflection) <= TOLERANCE) {
    return {
      technique: "quarter-wave",
      loadImpedance,
      characteristicImpedance,
      required: false,
      solutions: [{
        placementDistanceWavelengths: 0,
        transformerLengthWavelengths: 0.25,
        terminationResistanceOhms: characteristicImpedance,
        transformerImpedanceOhms: characteristicImpedance,
      }],
    };
  }

  if (Math.abs(loadImpedance.im) <= TOLERANCE) {
    return {
      technique: "quarter-wave",
      loadImpedance,
      characteristicImpedance,
      required: true,
      solutions: [solutionAtDistance(normalizedLoad, characteristicImpedance, 0)],
    };
  }

  const reflectionPhase = phase(reflection);
  const highResistanceDistance = wrapTwoPi(reflectionPhase) / FOUR_PI;
  const lowResistanceDistance = wrapTwoPi(reflectionPhase - Math.PI) / FOUR_PI;
  const solutions = [
    solutionAtDistance(normalizedLoad, characteristicImpedance, highResistanceDistance),
    solutionAtDistance(normalizedLoad, characteristicImpedance, lowResistanceDistance),
  ].sort((left, right) =>
    left.placementDistanceWavelengths - right.placementDistanceWavelengths);

  return {
    technique: "quarter-wave",
    loadImpedance,
    characteristicImpedance,
    required: true,
    solutions,
  };
}

export function evaluateQuarterWave(loadImpedance, characteristicImpedance, solution) {
  const normalizedLoad = normalizeImpedance(loadImpedance, characteristicImpedance);
  const impedanceAtTransformer = denormalizeImpedance(
    transformNormalizedImpedance(
      normalizedLoad,
      solution.placementDistanceWavelengths,
    ),
    characteristicImpedance,
  );
  // At λ/4, Zin = Zt² / Ztermination.
  return scale(reciprocal(impedanceAtTransformer), solution.transformerImpedanceOhms ** 2);
}
