import { complex, reciprocal, scale } from "../core/complex.js";
import { normalizeImpedance, reflectionCoefficient } from "../core/transmissionLine.js";
import { calculateSingleStub } from "./singleStub.js";

const TWO_PI = 2 * Math.PI;
const MAX_LENGTH = 0.499999;
const MIN_STUB_LENGTH = 1e-5;

function multiply(left, right) {
  return complex(
    left.re * right.re - left.im * right.im,
    left.re * right.im + left.im * right.re,
  );
}

function magnitude(value) {
  return Math.hypot(value.re, value.im);
}

function hyperbolicTangent(real, imaginary) {
  if (real > 20) return complex(1, 0);
  const denominator = Math.cosh(2 * real) + Math.cos(2 * imaginary);
  if (Math.abs(denominator) < 1e-14) {
    return complex(Number.POSITIVE_INFINITY, 0);
  }
  return complex(
    Math.sinh(2 * real) / denominator,
    Math.sin(2 * imaginary) / denominator,
  );
}

function lineReflectionAtDistance(loadReflection, distance, attenuationNpPerWavelength) {
  const attenuation = Math.exp(-2 * attenuationNpPerWavelength * distance);
  const phase = -2 * TWO_PI * distance;
  const propagation = complex(attenuation * Math.cos(phase), attenuation * Math.sin(phase));
  return multiply(loadReflection, propagation);
}

function admittanceFromReflection(reflection) {
  return multiply(
    complex(1 - reflection.re, -reflection.im),
    reciprocal(complex(1 + reflection.re, reflection.im)),
  );
}

function stubAdmittance(length, termination, attenuationNpPerWavelength) {
  const gammaLength = hyperbolicTangent(
    attenuationNpPerWavelength * length,
    TWO_PI * length,
  );
  return termination === "open" ? gammaLength : reciprocal(gammaLength);
}

function mismatchAt(loadReflection, distance, stubLength, termination, attenuationNpPerWavelength) {
  const lineReflection = lineReflectionAtDistance(loadReflection, distance, attenuationNpPerWavelength);
  const lineAdmittance = admittanceFromReflection(lineReflection);
  const totalAdmittance = complex(
    lineAdmittance.re + stubAdmittance(stubLength, termination, attenuationNpPerWavelength).re,
    lineAdmittance.im + stubAdmittance(stubLength, termination, attenuationNpPerWavelength).im,
  );
  return complex(totalAdmittance.re - 1, totalAdmittance.im);
}

function derivative(loadReflection, distance, stubLength, termination, attenuation, dimension) {
  const step = 1e-5;
  const low = dimension === "distance" ? Math.max(0, distance - step) : Math.max(MIN_STUB_LENGTH, stubLength - step);
  const high = dimension === "distance" ? Math.min(MAX_LENGTH, distance + step) : Math.min(MAX_LENGTH, stubLength + step);
  const lowValue = dimension === "distance"
    ? mismatchAt(loadReflection, low, stubLength, termination, attenuation)
    : mismatchAt(loadReflection, distance, low, termination, attenuation);
  const highValue = dimension === "distance"
    ? mismatchAt(loadReflection, high, stubLength, termination, attenuation)
    : mismatchAt(loadReflection, distance, high, termination, attenuation);
  return complex(
    (highValue.re - lowValue.re) / (high - low),
    (highValue.im - lowValue.im) / (high - low),
  );
}

function refineRoot(loadReflection, termination, attenuation, initialDistance, initialStubLength) {
  let distance = initialDistance;
  let stubLength = initialStubLength;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const error = mismatchAt(loadReflection, distance, stubLength, termination, attenuation);
    const errorMagnitude = magnitude(error);
    if (errorMagnitude < 1e-9) return { distance, stubLength, errorMagnitude };

    const withDistance = derivative(loadReflection, distance, stubLength, termination, attenuation, "distance");
    const withStub = derivative(loadReflection, distance, stubLength, termination, attenuation, "stub");
    const determinant = withDistance.re * withStub.im - withStub.re * withDistance.im;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return undefined;

    let distanceStep = (-error.re * withStub.im + withStub.re * error.im) / determinant;
    let stubStep = (withDistance.im * error.re - withDistance.re * error.im) / determinant;
    const stepMagnitude = Math.hypot(distanceStep, stubStep);
    if (!Number.isFinite(stepMagnitude)) return undefined;
    if (stepMagnitude > 0.18) {
      const scale = 0.18 / stepMagnitude;
      distanceStep *= scale;
      stubStep *= scale;
    }

    let improved = false;
    for (let scale = 1; scale >= 1 / 128; scale /= 2) {
      const nextDistance = Math.min(MAX_LENGTH, Math.max(0, distance + distanceStep * scale));
      const nextStubLength = Math.min(MAX_LENGTH, Math.max(MIN_STUB_LENGTH, stubLength + stubStep * scale));
      const nextError = magnitude(mismatchAt(loadReflection, nextDistance, nextStubLength, termination, attenuation));
      if (nextError < errorMagnitude) {
        distance = nextDistance;
        stubLength = nextStubLength;
        improved = true;
        break;
      }
    }
    if (!improved) return undefined;
  }
  return undefined;
}

function findSolutions(loadReflection, termination, attenuationNpPerWavelength) {
  const solutions = [];
  const seedCount = 16;
  for (let distanceIndex = 0; distanceIndex < seedCount; distanceIndex += 1) {
    const distance = MAX_LENGTH * distanceIndex / (seedCount - 1);
    for (let stubIndex = 0; stubIndex < seedCount; stubIndex += 1) {
      const stubLength = MIN_STUB_LENGTH + (MAX_LENGTH - MIN_STUB_LENGTH) * stubIndex / (seedCount - 1);
      const root = refineRoot(loadReflection, termination, attenuationNpPerWavelength, distance, stubLength);
      if (!root || root.errorMagnitude > 1e-8) continue;
      if (solutions.some((item) =>
        Math.abs(item.distanceWavelengths - root.distance) < 1e-6 &&
        Math.abs(item.stubLengthWavelengths - root.stubLength) < 1e-6)) continue;
      solutions.push({
        distanceWavelengths: root.distance,
        stubLengthWavelengths: root.stubLength,
        matchingError: root.errorMagnitude,
      });
    }
  }
  return solutions.sort((left, right) =>
    left.distanceWavelengths - right.distanceWavelengths || left.stubLengthWavelengths - right.stubLengthWavelengths);
}

/** Match a load through a lossy feed line using one shunt stub with the same Z0. */
export function calculateLossySingleStub(
  loadImpedance,
  characteristicImpedance,
  attenuationDbPerWavelength,
  termination = "short",
) {
  if (loadImpedance.re <= 0) throw new RangeError("loadImpedance must have positive resistance");
  if (!Number.isFinite(characteristicImpedance) || characteristicImpedance <= 0) {
    throw new RangeError("characteristicImpedance must be a positive finite number");
  }
  if (!Number.isFinite(attenuationDbPerWavelength) || attenuationDbPerWavelength < 0 || attenuationDbPerWavelength > 100) {
    throw new RangeError("attenuationDbPerWavelength must be between 0 and 100 dB per wavelength");
  }
  if (!new Set(["open", "short"]).has(termination)) {
    throw new RangeError('termination must be "open" or "short"');
  }

  const attenuationNpPerWavelength = attenuationDbPerWavelength / 8.685889638;
  const loadReflection = reflectionCoefficient(normalizeImpedance(loadImpedance, characteristicImpedance));
  const solutions = attenuationDbPerWavelength === 0
    ? calculateSingleStub(loadImpedance, characteristicImpedance).solutions.map((solution) => ({
      distanceWavelengths: solution.distanceWavelengths,
      stubLengthWavelengths: termination === "open"
        ? solution.openStubLengthWavelengths
        : solution.shortedStubLengthWavelengths,
      normalizedStubAdmittance: complex(0, solution.normalizedStubSusceptance),
      matchingError: 0,
    }))
    : findSolutions(loadReflection, termination, attenuationNpPerWavelength)
    .map(({ distanceWavelengths, stubLengthWavelengths, matchingError }) => ({
      distanceWavelengths,
      stubLengthWavelengths,
      normalizedStubAdmittance: stubAdmittance(stubLengthWavelengths, termination, attenuationNpPerWavelength),
      openStubLengthWavelengths: termination === "open" ? stubLengthWavelengths : null,
      shortedStubLengthWavelengths: termination === "short" ? stubLengthWavelengths : null,
      matchingError,
    }));

  const completeSolutions = solutions.map((solution) => ({
    ...solution,
    openStubLengthWavelengths: termination === "open" ? solution.stubLengthWavelengths : null,
    shortedStubLengthWavelengths: termination === "short" ? solution.stubLengthWavelengths : null,
  }));

  return {
    technique: "lossy-single-stub",
    loadImpedance,
    characteristicImpedance,
    attenuationDbPerWavelength,
    attenuationNpPerWavelength,
    termination,
    matchable: completeSolutions.length > 0,
    reason: completeSolutions.length ? undefined : "No lossy single-stub match was found within one half wavelength",
    solutions: completeSolutions,
  };
}

export function evaluateLossySingleStub(
  loadImpedance,
  characteristicImpedance,
  attenuationDbPerWavelength,
  solution,
  termination = "short",
) {
  const attenuation = attenuationDbPerWavelength / 8.685889638;
  const loadReflection = reflectionCoefficient(normalizeImpedance(loadImpedance, characteristicImpedance));
  const lineReflection = lineReflectionAtDistance(loadReflection, solution.distanceWavelengths, attenuation);
  const lineAdmittance = admittanceFromReflection(lineReflection);
  const stub = stubAdmittance(solution.stubLengthWavelengths, termination, attenuation);
  const total = complex(lineAdmittance.re + stub.re, lineAdmittance.im + stub.im);
  return scale(reciprocal(total), characteristicImpedance);
}

