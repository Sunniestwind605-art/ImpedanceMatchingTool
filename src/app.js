import {
  calculateDoubleStub,
  calculateLNetwork,
  calculateQuarterWave,
  calculateSingleStub,
  complex,
  renderDoubleStubSvg,
  renderLNetworkSvg,
  renderQuarterWaveSvg,
  renderSingleStubSvg,
} from "./index.js";

const form = document.querySelector("#matching-form");
const technique = document.querySelector("#technique");
const solutionPicker = document.querySelector("#solution");
const terminationPicker = document.querySelector("#termination");
const terminationField = document.querySelector("#termination-field");
const frequencyField = document.querySelector("#frequency-field");
const spacingField = document.querySelector("#spacing-field");
const diagram = document.querySelector("#diagram");
const error = document.querySelector("#error");

let currentResult;

function numberValue(selector) {
  return Number(document.querySelector(selector).value);
}

function updateFields() {
  const selected = technique.value;
  frequencyField.hidden = selected !== "l-network";
  spacingField.hidden = selected !== "double-stub";
  terminationField.hidden = !new Set(["single-stub", "double-stub"]).has(selected);
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

function renderCurrent() {
  if (!currentResult) return;
  const index = Number(solutionPicker.value || 0);
  const termination = terminationPicker.value;
  const selected = technique.value;
  if (selected === "l-network") diagram.innerHTML = renderLNetworkSvg(currentResult, index);
  if (selected === "single-stub") diagram.innerHTML = renderSingleStubSvg(currentResult, index, termination);
  if (selected === "double-stub") {
    diagram.innerHTML = renderDoubleStubSvg(currentResult, index, {
      firstTermination: termination,
      secondTermination: termination,
    });
  }
  if (selected === "quarter-wave") diagram.innerHTML = renderQuarterWaveSvg(currentResult, index);
}

function calculate() {
  error.textContent = "";
  const load = complex(numberValue("#load-resistance"), numberValue("#load-reactance"));
  const z0 = numberValue("#characteristic-impedance");
  const selected = technique.value;
  if (selected === "l-network") currentResult = calculateLNetwork(load, z0, numberValue("#frequency"));
  if (selected === "single-stub") currentResult = calculateSingleStub(load, z0);
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
    error.textContent = caught instanceof Error ? caught.message : String(caught);
  }
});

technique.addEventListener("change", () => {
  updateFields();
  form.requestSubmit();
});
solutionPicker.addEventListener("change", renderCurrent);
terminationPicker.addEventListener("change", renderCurrent);

updateFields();
calculate();
