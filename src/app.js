import {
  calculateDoubleStub,
  calculateLNetwork,
  calculateLossySingleStub,
  calculateQuarterWave,
  calculateSingleStub,
  complex,
  renderDoubleStubSvg,
  renderLNetworkSvg,
  renderQuarterWaveSvg,
  renderSmithChartSvg,
  renderSingleStubSvg,
} from "./index.js?v=offline-v2";

const form = document.querySelector("#matching-form");
const technique = document.querySelector("#technique");
const solutionPicker = document.querySelector("#solution");
const terminationPicker = document.querySelector("#termination");
const terminationField = document.querySelector("#termination-field");
const frequencyField = document.querySelector("#frequency-field");
const spacingField = document.querySelector("#spacing-field");
const attenuationField = document.querySelector("#attenuation-field");
const diagram = document.querySelector("#diagram");
const smithChart = document.querySelector("#smith-chart");
const smithChartDialog = document.querySelector("#smith-chart-dialog");
const smithChartExpanded = document.querySelector("#smith-chart-expanded");
const chartReplay = document.querySelector("#chart-replay");
const chartExpand = document.querySelector("#chart-expand");
const chartClose = document.querySelector("#chart-close");
const resultDetails = document.querySelector("#result-details");
const error = document.querySelector("#error");

let currentResult;

function numberValue(selector) {
  return Number(document.querySelector(selector).value);
}

function updateFields() {
  const selected = technique.value;
  frequencyField.hidden = selected !== "l-network";
  spacingField.hidden = selected !== "double-stub";
  attenuationField.hidden = selected !== "lossy-single-stub";
  terminationField.hidden = !new Set(["single-stub", "lossy-single-stub", "double-stub"]).has(selected);
}

function populateSolutions(result) {
  solutionPicker.replaceChildren();
  const count = Math.max(1, result.solutions.length);
  for (let index = 0; index < count; index += 1) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = result.solutions.length ? `Solution ${index + 1}` : "Unavailable";
    solutionPicker.append(option);
  }
  solutionPicker.disabled = result.solutions.length <= 1;
}

function detail(label, value) {
  return `<div class="detail-item"><span>${label}</span><strong>${value}</strong></div>`;
}

function formatLength(value) {
  return `${value.toFixed(6)} λ`;
}

function renderDetails(result, selected, solution) {
  const values = [];
  if (!solution) {
    values.push(detail("Status", result.reason ?? "No matching solution"));
  } else if (selected === "single-stub") {
    values.push(detail("Line distance to stub", formatLength(solution.distanceWavelengths)));
    values.push(detail("Open stub length", formatLength(solution.openStubLengthWavelengths)));
    values.push(detail("Shorted stub length", formatLength(solution.shortedStubLengthWavelengths)));
    values.push(detail("Normalized stub susceptance", solution.normalizedStubSusceptance.toFixed(6)));
  } else if (selected === "lossy-single-stub") {
    values.push(detail("Line attenuation", `${result.attenuationDbPerWavelength.toFixed(4)} dB/λ`));
    values.push(detail("Line distance to stub", formatLength(solution.distanceWavelengths)));
    values.push(detail(`${terminationPicker.value === "open" ? "Open" : "Shorted"} stub length`, formatLength(solution.stubLengthWavelengths)));
    values.push(detail("Matching residual", solution.matchingError.toExponential(2)));
  } else if (selected === "double-stub") {
    values.push(detail("Distance to first stub", formatLength(result.firstStubDistanceWavelengths)));
    values.push(detail("Spacing between stubs", formatLength(result.spacingWavelengths)));
    values.push(detail("Stub 1 open / short", `${formatLength(solution.firstOpenStubLengthWavelengths)} / ${formatLength(solution.firstShortedStubLengthWavelengths)}`));
    values.push(detail("Stub 2 open / short", `${formatLength(solution.secondOpenStubLengthWavelengths)} / ${formatLength(solution.secondShortedStubLengthWavelengths)}`));
    values.push(detail("Stub susceptances b₁ / b₂", `${solution.firstStubSusceptance.toFixed(5)} / ${solution.secondStubSusceptance.toFixed(5)}`));
  } else if (selected === "l-network") {
    values.push(detail("Network topology", solution.topology));
    values.push(detail("Series element", `${solution.seriesComponent.kind}: ${solution.seriesComponent.value.toPrecision(5)} ${solution.seriesComponent.unit ?? ""}`));
    values.push(detail("Shunt element", `${solution.shuntComponent.kind}: ${solution.shuntComponent.value.toPrecision(5)} ${solution.shuntComponent.unit ?? ""}`));
  } else if (selected === "quarter-wave") {
    values.push(detail("Line distance to transformer", formatLength(solution.placementDistanceWavelengths)));
    values.push(detail("Transformer length", formatLength(solution.transformerLengthWavelengths)));
    values.push(detail("Transformer impedance", `${solution.transformerImpedanceOhms.toFixed(4)} Ω`));
  }
  resultDetails.innerHTML = values.join("");
}

function renderCurrent() {
  if (!currentResult) return;
  const index = Number(solutionPicker.value || 0);
  const termination = terminationPicker.value;
  const selected = technique.value;
  const solution = currentResult.solutions[index];
  if (!solution) {
    diagram.replaceChildren();
    smithChart.innerHTML = renderSmithChartSvg(currentResult, selected, index);
    if (smithChartDialog.open) {
      smithChartExpanded.innerHTML = renderSmithChartSvg(currentResult, selected, index, { detail: "full" });
    }
    renderDetails(currentResult, selected, solution);
    return;
  }
  if (selected === "l-network") diagram.innerHTML = renderLNetworkSvg(currentResult, index);
  if (selected === "single-stub") diagram.innerHTML = renderSingleStubSvg(currentResult, index, termination);
  if (selected === "lossy-single-stub") diagram.innerHTML = renderSingleStubSvg(currentResult, index, termination);
  if (selected === "double-stub") {
    diagram.innerHTML = renderDoubleStubSvg(currentResult, index, {
      firstTermination: termination,
      secondTermination: termination,
    });
  }
  if (selected === "quarter-wave") diagram.innerHTML = renderQuarterWaveSvg(currentResult, index);
  const chartSvg = renderSmithChartSvg(currentResult, selected, index);
  smithChart.innerHTML = chartSvg;
  if (smithChartDialog.open) {
    smithChartExpanded.innerHTML = renderSmithChartSvg(currentResult, selected, index, { detail: "full" });
  }
  renderDetails(currentResult, selected, solution);
}

function calculate() {
  error.textContent = "";
  const load = complex(numberValue("#load-resistance"), numberValue("#load-reactance"));
  const z0 = numberValue("#characteristic-impedance");
  const selected = technique.value;
  if (selected === "l-network") currentResult = calculateLNetwork(load, z0, numberValue("#frequency"));
  if (selected === "single-stub") currentResult = calculateSingleStub(load, z0);
  if (selected === "lossy-single-stub") currentResult = calculateLossySingleStub(load, z0, numberValue("#attenuation"), terminationPicker.value);
  if (selected === "double-stub") currentResult = calculateDoubleStub(load, z0, numberValue("#spacing"));
  if (selected === "quarter-wave") currentResult = calculateQuarterWave(load, z0);
  populateSolutions(currentResult);
  renderCurrent();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    calculate();
  } catch (caught) {
    currentResult = undefined;
    diagram.replaceChildren();
    smithChart.replaceChildren();
    resultDetails.replaceChildren();
    error.textContent = caught instanceof Error ? caught.message : String(caught);
  }
});

technique.addEventListener("change", () => {
  updateFields();
  form.requestSubmit();
});
solutionPicker.addEventListener("change", renderCurrent);
terminationPicker.addEventListener("change", () => {
  if (technique.value === "lossy-single-stub") calculate();
  else renderCurrent();
});
chartReplay.addEventListener("click", renderCurrent);
chartExpand.addEventListener("click", () => {
  if (!currentResult) return;
  const index = Number(solutionPicker.value || 0);
  smithChartExpanded.innerHTML = renderSmithChartSvg(currentResult, technique.value, index, { detail: "full" });
  smithChartDialog.showModal();
});
chartClose.addEventListener("click", () => smithChartDialog.close());
smithChartDialog.addEventListener("click", (event) => {
  if (event.target === smithChartDialog) smithChartDialog.close();
});

updateFields();
calculate();

const offlineStatus = document.querySelector("#offline-status");
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        offlineStatus.textContent = "Ready for offline use in this browser.";
      })
      .catch((caught) => {
        offlineStatus.textContent = "Offline storage could not be enabled in this browser.";
        console.warn("Offline support could not be enabled in this browser.", caught);
      });
  }, { once: true });
} else {
  offlineStatus.textContent = "Offline use is not supported by this browser.";
}
