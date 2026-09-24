import { add, complex, reciprocal } from "../core/complex.js";

const TOLERANCE = 1e-12;

function assertInputs(loadImpedance, sourceResistance, frequencyHz) {
  if (loadImpedance.re <= 0) {
    throw new RangeError("loadImpedance must have positive resistance");
  }
  if (!Number.isFinite(sourceResistance) || sourceResistance <= 0) {
    throw new RangeError("sourceResistance must be a positive finite number");
  }
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError("frequencyHz must be a positive finite number");
  }
}

function reactanceComponent(reactanceOhms, frequencyHz) {
  const omega = 2 * Math.PI * frequencyHz;
  if (Math.abs(reactanceOhms) <= TOLERANCE) {
    return { kind: "none", value: 0, unit: null };
  }
  return reactanceOhms > 0
    ? { kind: "inductor", value: reactanceOhms / omega, unit: "H" }
    : { kind: "capacitor", value: -1 / (omega * reactanceOhms), unit: "F" };
}

function susceptanceComponent(susceptanceSiemens, frequencyHz) {
  const omega = 2 * Math.PI * frequencyHz;
  if (Math.abs(susceptanceSiemens) <= TOLERANCE) {
    return { kind: "none", value: 0, unit: null };
  }
  return susceptanceSiemens > 0
    ? { kind: "capacitor", value: susceptanceSiemens / omega, unit: "F" }
    : { kind: "inductor", value: -1 / (omega * susceptanceSiemens), unit: "H" };
}

function decorate(topology, seriesReactanceOhms, shuntSusceptanceSiemens, frequencyHz) {
  return {
    topology,
    seriesReactanceOhms,
    shuntSusceptanceSiemens,
    seriesComponent: reactanceComponent(seriesReactanceOhms, frequencyHz),
    shuntComponent: susceptanceComponent(shuntSusceptanceSiemens, frequencyHz),
  };
}

/**
 * Calculate both lossless L-network solutions that match a complex load to a
 * real source resistance. Topology names describe operation order while moving
 * from the load toward the source.
 */
export function calculateLNetwork(loadImpedance, sourceResistance, frequencyHz) {
  assertInputs(loadImpedance, sourceResistance, frequencyHz);
  const { re: resistance, im: loadReactance } = loadImpedance;

  if (
    Math.abs(resistance - sourceResistance) <= TOLERANCE
    && Math.abs(loadReactance) <= TOLERANCE
  ) {
    return {
      technique: "l-network",
      loadImpedance,
      sourceResistance,
      frequencyHz,
      solutions: [decorate("matched", 0, 0, frequencyHz)],
    };
  }

  const solutions = [];

  // Add a series reactance at the load, then a shunt susceptance source-side.
  const seriesDiscriminant = resistance * sourceResistance - resistance * resistance;
  if (seriesDiscriminant >= -TOLERANCE) {
    const magnitude = Math.sqrt(Math.max(0, seriesDiscriminant));
    for (const totalReactance of new Set([magnitude, -magnitude])) {
      const seriesReactance = totalReactance - loadReactance;
      const admittance = reciprocal(complex(resistance, totalReactance));
      solutions.push(decorate(
        "series-then-shunt",
        seriesReactance,
        -admittance.im,
        frequencyHz,
      ));
    }
  }

  // Add a shunt susceptance at the load, then a series reactance source-side.
  const loadAdmittance = reciprocal(loadImpedance);
  const shuntDiscriminant = loadAdmittance.re / sourceResistance
    - loadAdmittance.re * loadAdmittance.re;
  if (shuntDiscriminant >= -TOLERANCE) {
    const magnitude = Math.sqrt(Math.max(0, shuntDiscriminant));
    for (const totalSusceptance of new Set([magnitude, -magnitude])) {
      const shuntSusceptance = totalSusceptance - loadAdmittance.im;
      const parallelImpedance = reciprocal(complex(loadAdmittance.re, totalSusceptance));
      solutions.push(decorate(
        "shunt-then-series",
        -parallelImpedance.im,
        shuntSusceptance,
        frequencyHz,
      ));
    }
  }

  return {
    technique: "l-network",
    loadImpedance,
    sourceResistance,
    frequencyHz,
    solutions,
  };
}

export function evaluateLNetwork(loadImpedance, solution) {
  if (solution.topology === "matched") {
    return loadImpedance;
  }
  const series = complex(0, solution.seriesReactanceOhms);
  const shunt = complex(0, solution.shuntSusceptanceSiemens);
  if (solution.topology === "series-then-shunt") {
    return reciprocal(add(reciprocal(add(loadImpedance, series)), shunt));
  }
  if (solution.topology === "shunt-then-series") {
    return add(reciprocal(add(reciprocal(loadImpedance), shunt)), series);
  }
  throw new RangeError(`Unknown L-network topology: ${solution.topology}`);
}
