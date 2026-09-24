import { complex, reciprocal } from "../core/complex.js?v=lossy-mode-4";
import {
  reflectionCoefficient,
  transformNormalizedAdmittance,
  transformNormalizedImpedance,
  wrapHalfWavelength,
} from "../core/transmissionLine.js?v=lossy-mode-4";
import { svgDocument } from "./svg.js?v=lossy-mode-4";

const SIZE = 640;
const CENTER = SIZE / 2;
const RADIUS = 250;

function pointFromReflection(gamma) {
  return {
    x: CENTER + gamma.re * RADIUS,
    y: CENTER - gamma.im * RADIUS,
  };
}

function pathFromReflections(reflections) {
  return reflections.map((gamma, index) => {
    const { x, y } = pointFromReflection(gamma);
    return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function sampleLineImpedance(load, distance) {
  const steps = Math.max(24, Math.ceil(distance * 400));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const d = distance * index / steps;
    return reflectionCoefficient(transformNormalizedImpedance(load, d));
  });
}

function sampleLineAdmittance(loadY, distance) {
  const steps = Math.max(24, Math.ceil(distance * 400));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const d = distance * index / steps;
    const y = transformNormalizedAdmittance(loadY, d);
    return reflectionCoefficient(reciprocal(y));
  });
}

function multiply(left, right) {
  return complex(left.re * right.re - left.im * right.im, left.re * right.im + left.im * right.re);
}

function lossyLineReflection(loadReflection, distance, attenuationNpPerWavelength) {
  const magnitude = Math.exp(-2 * attenuationNpPerWavelength * distance);
  const phase = -4 * Math.PI * distance;
  return multiply(loadReflection, complex(magnitude * Math.cos(phase), magnitude * Math.sin(phase)));
}

function lossyLineAdmittance(loadReflection, distance, attenuationNpPerWavelength) {
  const gamma = lossyLineReflection(loadReflection, distance, attenuationNpPerWavelength);
  return multiply(complex(1 - gamma.re, -gamma.im), reciprocal(complex(1 + gamma.re, gamma.im)));
}

function lossyStubAdmittance(length, termination, attenuationNpPerWavelength) {
  if (termination === "short" && length < 1e-12) return complex(1e12, 0);
  const real = attenuationNpPerWavelength * length;
  const imaginary = 2 * Math.PI * length;
  const denominator = Math.cosh(2 * real) + Math.cos(2 * imaginary);
  const tanh = complex(Math.sinh(2 * real) / denominator, Math.sin(2 * imaginary) / denominator);
  return termination === "open" ? tanh : reciprocal(tanh);
}

function lossyLinePath(loadReflection, distance, attenuationNpPerWavelength) {
  const steps = Math.max(24, Math.ceil(distance * 400));
  return Array.from({ length: steps + 1 }, (_, index) =>
    lossyLineReflection(loadReflection, distance * index / steps, attenuationNpPerWavelength));
}

function lossyStubPath(lineAdmittance, length, termination, attenuationNpPerWavelength) {
  const steps = Math.max(60, Math.ceil(length * 400));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const stub = lossyStubAdmittance(length * index / steps, termination, attenuationNpPerWavelength);
    return gammaFromY(complex(lineAdmittance.re + stub.re, lineAdmittance.im + stub.im));
  });
}

function gammaFromY(y) {
  return reflectionCoefficient(reciprocal(y));
}

function shuntArc(admittance, susceptanceAdded) {
  const steps = Math.max(12, Math.ceil(Math.abs(susceptanceAdded) * 40));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const b = susceptanceAdded * index / steps;
    return gammaFromY(complex(admittance.re, admittance.im + b));
  });
}

function seriesArc(impedance, normalizedReactanceAdded) {
  const steps = Math.max(16, Math.ceil(Math.abs(normalizedReactanceAdded) * 40));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const x = impedance.im + normalizedReactanceAdded * index / steps;
    return reflectionCoefficient(complex(impedance.re, x));
  });
}

function sampleLNetwork(result, solution) {
  const zLoad = {
    re: result.loadImpedance.re / result.sourceResistance,
    im: result.loadImpedance.im / result.sourceResistance,
  };
  const start = reflectionCoefficient(complex(zLoad.re, zLoad.im));
  if (solution.topology === "matched") return [start, complex(0)];

  if (solution.topology === "series-then-shunt") {
    const seriesImpedance = complex(
      zLoad.re,
      zLoad.im + solution.seriesReactanceOhms / result.sourceResistance,
    );
    const beforeShuntY = reciprocal(seriesImpedance);
    const shuntB = solution.shuntSusceptanceSiemens * result.sourceResistance;
    return [start, ...seriesArc(complex(zLoad.re, zLoad.im), solution.seriesReactanceOhms / result.sourceResistance).slice(1), ...shuntArc(beforeShuntY, shuntB).slice(1)];
  }

  const loadY = reciprocal(complex(zLoad.re, zLoad.im));
  const shuntB = solution.shuntSusceptanceSiemens * result.sourceResistance;
  const yAfterShunt = complex(loadY.re, loadY.im + shuntB);
  const afterShuntZ = reciprocal(yAfterShunt);
  const gammaAfterShunt = reflectionCoefficient(afterShuntZ);
  return [start, ...shuntArc(loadY, shuntB).slice(1), ...seriesArc(afterShuntZ, solution.seriesReactanceOhms / result.sourceResistance).slice(1)];
}

function traceFor(result, technique, solution) {
  if (technique === "l-network") return [{ label: "Load → match", points: sampleLNetwork(result, solution) }];

  if (technique === "lossy-single-stub") {
    const load = complex(
      result.loadImpedance.re / result.characteristicImpedance,
      result.loadImpedance.im / result.characteristicImpedance,
    );
    const loadReflection = reflectionCoefficient(load);
    const lineAdmittance = lossyLineAdmittance(loadReflection, solution.distanceWavelengths, result.attenuationNpPerWavelength);
    return [
      { label: "Load → lossy stub position", points: lossyLinePath(loadReflection, solution.distanceWavelengths, result.attenuationNpPerWavelength) },
      { label: "Lossy stub → match", points: lossyStubPath(lineAdmittance, solution.stubLengthWavelengths, result.termination, result.attenuationNpPerWavelength) },
    ];
  }

  if (technique === "single-stub") {
    const loadY = reciprocal(complex(
      result.loadImpedance.re / result.characteristicImpedance,
      result.loadImpedance.im / result.characteristicImpedance,
    ));
    const line = sampleLineAdmittance(loadY, solution.distanceWavelengths);
    const yAtStub = transformNormalizedAdmittance(loadY, solution.distanceWavelengths);
    const stubB = solution.normalizedStubSusceptance;
    return [
      { label: "Load → stub position", points: line },
      { label: "Stub position → match", points: shuntArc(yAtStub, stubB) },
    ];
  }

  if (technique === "double-stub") {
    const loadY = reciprocal(complex(
      result.loadImpedance.re / result.characteristicImpedance,
      result.loadImpedance.im / result.characteristicImpedance,
    ));
    const startDistance = result.firstStubDistanceWavelengths;
    const firstLine = sampleLineAdmittance(loadY, startDistance);
    const yAtFirst = transformNormalizedAdmittance(loadY, startDistance);
    const firstAddition = shuntArc(yAtFirst, solution.firstStubSusceptance);
    const yAfterFirst = complex(
      yAtFirst.re,
      yAtFirst.im + solution.firstStubSusceptance,
    );
    const secondLine = sampleLineAdmittance(yAfterFirst, result.spacingWavelengths);
    const yAtSecond = transformNormalizedAdmittance(yAfterFirst, result.spacingWavelengths);
    const secondAddition = shuntArc(yAtSecond, solution.secondStubSusceptance);
    return [
      { label: "Load → first stub", points: firstLine },
      { label: "First stub", points: firstAddition },
      { label: "Between stubs", points: secondLine },
      { label: "Second stub → match", points: secondAddition },
    ];
  }

  if (technique === "quarter-wave") {
    const load = complex(
      result.loadImpedance.re / result.characteristicImpedance,
      result.loadImpedance.im / result.characteristicImpedance,
    );
    const line = sampleLineImpedance(load, solution.placementDistanceWavelengths);
    const atTransformer = transformNormalizedImpedance(load, solution.placementDistanceWavelengths);
    const startGamma = reflectionCoefficient(atTransformer);
    const steps = 100;
    const quarterWaveArc = Array.from({ length: steps + 1 }, (_, index) => {
      const fraction = index / steps;
      const angle = Math.atan2(startGamma.im, startGamma.re) + Math.PI * fraction;
      const radius = Math.hypot(startGamma.re, startGamma.im) * (1 - fraction);
      return complex(radius * Math.cos(angle), radius * Math.sin(angle));
    });
    return [
      { label: "Load → real crossing", points: line },
      { label: "Quarter-wave section → match", points: quarterWaveArc },
    ];
  }
  return [];
}

function gridSvg(detailed) {
  const parts = [];
  let gridOrder = 0;
  const resistanceValues = detailed
    ? [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.4, 2, 3, 5, 10, 20, 50]
    : [0, 0.5, 1, 2];
  const labeledResistanceValues = new Set([0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.4, 2, 3, 5, 10]);
  for (const r of resistanceValues) {
    const centerGamma = r / (1 + r);
    const radiusGamma = 1 / (1 + r);
    const center = pointFromReflection(complex(centerGamma, 0));
    const circleRadius = radiusGamma * RADIUS;
    const order = gridOrder++;
    parts.push(`<circle class="smith-grid" style="--grid-order:${order}" cx="${center.x}" cy="${center.y}" r="${circleRadius}"/>`);
    if (detailed && labeledResistanceValues.has(r)) {
      const realGamma = (r - 1) / (r + 1);
      const labelPoint = pointFromReflection(complex(realGamma, 0));
      parts.push(`<text class="smith-grid-label resistance-label" x="${labelPoint.x}" y="${CENTER + 16}" text-anchor="middle" style="--grid-order:${gridOrder++}">${r}</text>`);
    }
  }

  const reactanceValues = detailed
    ? [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.4, 2, 3, 5, 10, 20, 50]
    : [0.5, 1, 2];
  for (const magnitude of reactanceValues) {
    for (const x of [-magnitude, magnitude]) {
      const samples = [];
      const maxResistance = 500;
      const logRange = Math.log1p(maxResistance);
      const count = detailed ? 220 : 120;
      for (let index = 0; index <= count; index += 1) {
        const fraction = index / count;
        const resistance = Math.expm1(fraction * logRange);
        samples.push(reflectionCoefficient(complex(resistance, x)));
      }
      const order = gridOrder++;
      parts.push(`<path class="smith-grid" style="--grid-order:${order}" d="${pathFromReflections(samples)}"/>`);

      if (!detailed || magnitude > 5) continue;
      const reactanceGamma = reflectionCoefficient(complex(0, x));
      const reactancePoint = pointFromReflection(reactanceGamma);
      const labelX = reactancePoint.x + (reactancePoint.x < CENTER ? 10 : -10);
      const labelY = reactancePoint.y + (x > 0 ? 5 : -3);
      parts.push(`<text class="smith-grid-label reactance-label" x="${labelX}" y="${labelY}" text-anchor="${reactancePoint.x < CENTER ? "start" : "end"}" style="--grid-order:${gridOrder++}">${magnitude}</text>`);
    }
  }
  parts.push(`<line class="smith-axis" x1="${CENTER - RADIUS}" y1="${CENTER}" x2="${CENTER + RADIUS}" y2="${CENTER}"/>`);
  parts.push(`<circle class="smith-boundary" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}"/>`);
  parts.push(`<circle class="smith-match" cx="${CENTER}" cy="${CENTER}" r="5"/>`);
  parts.push(`<text class="smith-tick" x="${CENTER - RADIUS}" y="${CENTER + 32}" text-anchor="middle">−1</text>`);
  parts.push(`<text class="smith-tick" x="${CENTER + RADIUS}" y="${CENTER + 32}" text-anchor="middle">+1</text>`);
  parts.push(`<text class="smith-tick" x="${CENTER + 10}" y="${CENTER - RADIUS + 16}">+j</text>`);
  parts.push(`<text class="smith-tick" x="${CENTER + 10}" y="${CENTER + RADIUS - 4}">−j</text>`);
  return parts.join("\n");
}

function markers(start, end, traces, technique, animationStart) {
  const s = pointFromReflection(start);
  const e = pointFromReflection(end);
  const lastTraceDelay = animationStart + Math.max(0, traces.length - 1) * 1.4 + 1.3;
  const intermediate = traces.slice(0, -1).map((trace, index) => {
    const lastPoint = trace.points.at(-1) ?? start;
    const p = pointFromReflection(lastPoint);
    const pointLabel = technique === "single-stub" || technique === "lossy-single-stub"
      ? "Stub"
      : technique === "double-stub"
        ? ["Stub 1", "After stub 1", "Stub 2"][index] ?? `Step ${index + 1}`
        : technique === "quarter-wave"
          ? "Real Z"
          : "Network step";
    return `<circle class="smith-step" cx="${p.x}" cy="${p.y}" r="6" style="--step-order:${index};--trace-start:${animationStart}s"><title>${pointLabel} point</title></circle>
      <text class="smith-step-label" x="${p.x + 9}" y="${p.y + 18}" style="--step-order:${index};--trace-start:${animationStart}s">${pointLabel}</text>`;
  }).join("\n");
  const startPointDelay = animationStart - 0.15;
  return `<circle class="smith-start" cx="${s.x}" cy="${s.y}" r="7" style="--point-delay:${startPointDelay}s"><title>Starting load point</title></circle>
  <text class="smith-marker-label" x="${s.x + 10}" y="${s.y - 10}" style="--point-delay:${startPointDelay}s">Start</text>
  ${intermediate}
  <circle class="smith-end" cx="${e.x}" cy="${e.y}" r="7" style="--point-delay:${lastTraceDelay}s"><title>Matched endpoint</title></circle>
  <text class="smith-marker-label smith-match-label" x="${e.x + 10}" y="${e.y - 10}" style="--point-delay:${lastTraceDelay}s">Match</text>`;
}

export function renderSmithChartSvg(result, technique, solutionIndex = 0, options = {}) {
  const detailed = options.detail === "full";
  const animationStart = detailed ? 1.8 : 1.25;
  const solution = result.solutions[solutionIndex];
  if (!solution) {
    return svgDocument(`<rect class="panel" x="10" y="10" width="400" height="400" rx="18"/>
      <text class="label" x="210" y="210" text-anchor="middle">No matching solution on this chart.</text>`, {
      width: 420,
      height: 420,
      label: "No Smith chart solution available",
    });
  }

  const traces = traceFor(result, technique, solution);
  const loadZ = technique === "l-network"
    ? complex(result.loadImpedance.re / result.sourceResistance, result.loadImpedance.im / result.sourceResistance)
    : complex(result.loadImpedance.re / result.characteristicImpedance, result.loadImpedance.im / result.characteristicImpedance);
  const start = reflectionCoefficient(loadZ);
  const end = complex(0);
  const traceSvg = traces.map((trace, index) => {
    const points = trace.points;
    if (index === 0 && points.length) {
      points[0] = start;
      if (index === traces.length - 1) points[points.length - 1] = end;
    }
    if (index === traces.length - 1 && points.length) points[points.length - 1] = end;
    return `<path class="smith-trace trace-${index}" pathLength="1" d="${pathFromReflections(points)}" style="--draw-order:${index};--trace-start:${animationStart}s" aria-label="${trace.label}"/>`;
  }).join("\n");
  const gammaMagnitude = Math.hypot(start.re, start.im);
  const standingWaveRatio = gammaMagnitude >= 0.999999
    ? "∞"
    : ((1 + gammaMagnitude) / (1 - gammaMagnitude)).toFixed(2);
  const vswrReference = `<circle class="smith-vswr-reference" pathLength="1" cx="${CENTER}" cy="${CENTER}" r="${(gammaMagnitude * RADIUS).toFixed(2)}" style="--grid-order:0;animation-delay:${animationStart - 0.1}s"/>`;

  return svgDocument(`<rect class="panel" x="4" y="4" width="632" height="632" rx="18"/>
  <g class="${detailed ? "smith-grid-detailed" : "smith-grid-compact"}">
  ${gridSvg(detailed)}
  </g>
  ${vswrReference}
  ${traceSvg}
  ${markers(start, end, traces, technique, animationStart)}
  <text class="smith-caption" x="${CENTER}" y="${SIZE - 17}" text-anchor="middle">Normalized impedance • clockwise toward generator • VSWR ${standingWaveRatio}:1</text>`, {
    width: SIZE,
    height: SIZE,
    label: `Animated Smith chart with normalized resistance and reactance values for ${technique}`,
  });
}
