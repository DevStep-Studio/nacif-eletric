import assert from "node:assert/strict";
import {
  maskCep,
  maskPhone,
  maskCpfCnpj,
  parsePtBrFloat,
  formatPtBrDecimal,
  cleanDigits,
} from "../src/lib/brFormatters.js";
import {
  defaultWizardState,
  getStepErrors,
  getPreliminarySizing,
  getBatteryAutonomyHours,
  getInstantResults,
} from "../src/lib/solarWizardState.js";

console.log("🧪 Iniciando testes de fumaça completos do assistente solar...");

// 1. Testes de Máscaras e Formatação pt-BR
assert.equal(maskCep("01310100"), "01310-100", "Máscara de CEP 8 dígitos OK");
assert.equal(cleanDigits("01310-100"), "01310100", "Clean digits OK");
assert.equal(maskPhone("11987654321"), "(11) 98765-4321", "Máscara de celular SP OK");
assert.equal(maskPhone("1133334444"), "(11) 3333-4444", "Máscara de fixo OK");

assert.equal(parsePtBrFloat("11,55"), 11.55, "Parsing com vírgula OK");
assert.equal(parsePtBrFloat("11.55"), 11.55, "Parsing com ponto OK");
assert.equal(parsePtBrFloat("R$ 1.250,50"), 1250.50, "Parsing com moeda e separador de milhar OK");
assert.equal(parsePtBrFloat("", 0), 0, "Fallback vazio OK");

assert.equal(formatPtBrDecimal(11.55, { minDecimals: 2 }), "11,55", "Formatação decimal pt-BR OK");
console.log("✅ 1. Máscaras e conversão decimal pt-BR OK");

// 2. Testes de Validação das 6 Etapas (getStepErrors)
const emptyState = defaultWizardState();
const dadosErrors = getStepErrors("dados", emptyState);
assert.ok(dadosErrors.length > 0, "Etapa 'dados' vazia gera erro de nome obrigatório");

const validDadosState = {
  ...emptyState,
  name: "Residência Teste",
  entry_method: "power",
  desired_power_kwp: 10,
};
assert.equal(getStepErrors("dados", validDadosState).length, 0, "Etapa 'dados' preenchida não gera erros");

const consumoErrors = getStepErrors("consumo", validDadosState);
assert.ok(consumoErrors.length > 0, "Etapa 'consumo' vazia gera erro de consumo e tarifa");

const validConsumoState = {
  ...validDadosState,
  monthly_consumption_kwh: 600,
  tariff_brl_kwh: 0.95,
};
assert.equal(getStepErrors("consumo", validConsumoState).length, 0, "Etapa 'consumo' preenchida válida");

const localizacaoErrors = getStepErrors("localizacao", validConsumoState);
assert.ok(localizacaoErrors.length > 0, "Etapa 'localizacao' vazia gera erro de endereço, cidade e UF");

const validLocState = {
  ...validConsumoState,
  address: "Av. Paulista",
  city: "São Paulo",
  state: "SP",
};
assert.equal(getStepErrors("localizacao", validLocState).length, 0, "Etapa 'localizacao' válida");

const telhadoErrors = getStepErrors("telhado", validLocState);
assert.ok(telhadoErrors.length > 0, "Etapa 'telhado' sem polígono desenhado gera erro");

const validTelhadoState = {
  ...validLocState,
  roof_defined: true,
  roof_polygon: [
    { lat: -23.55, lng: -46.63 },
    { lat: -23.55, lng: -46.629 },
    { lat: -23.549, lng: -46.629 },
    { lat: -23.549, lng: -46.63 },
  ],
};
assert.equal(getStepErrors("telhado", validTelhadoState).length, 0, "Etapa 'telhado' desenhado válida");

const validEquipState = {
  ...validTelhadoState,
  inverter_kw: 5,
  module_wp: 550,
};
assert.equal(getStepErrors("equipamentos", validEquipState).length, 0, "Etapa 'equipamentos' válida");
console.log("✅ 2. Validações das 6 etapas do Wizard OK");

// 3. Testes de Dimensionamento Preliminar
const sizingPower = getPreliminarySizing({ entry_method: "power", desired_power_kwp: 5.5, module_wp: 550 });
assert.equal(sizingPower.panelCount, 10, "5.5 kWp com módulos de 550Wp = 10 módulos");
assert.equal(sizingPower.installedKwp, 5.5, "Potência instalada = 5.5 kWp");

const sizingArea = getPreliminarySizing({ entry_method: "area", available_area_m2: 60, module_wp: 550 });
assert.ok(sizingArea.panelCount > 0, "Dimensionamento por área retorna quantidade positiva de módulos");
console.log("✅ 3. Dimensionamento preliminar dinâmico OK");

// 4. Testes de Autonomia de Bateria
const batteryAutonomy = getBatteryAutonomyHours({
  capacity_kwh: 10,
  depth_of_discharge_pct: 80,
  efficiency_pct: 90,
  priority_loads: [
    { name: "Geladeira", power_w: 200 },
    { name: "Roteador", power_w: 100 },
  ],
});
assert.ok(batteryAutonomy > 0, "Autonomia calculada com sucesso");
assert.ok(batteryAutonomy > 20, "10 kWh com 300W de carga rende mais de 20 horas");
console.log("✅ 4. Cálculo de autonomia e bateria OK");

// 5. Testes de Resultados Instantâneos
const instant = getInstantResults(validEquipState);
assert.ok(instant.installedKwp > 0, "Potência instalada calculada");
assert.ok(instant.annualGenerationKwh > 0, "Geração anual calculada");
assert.ok(instant.annualSavingsBrl > 0, "Economia anual calculada");
console.log("✅ 5. Geração de resultados instantâneos OK");

console.log("🎉 Todos os testes de fumaça do módulo solar passaram com sucesso!");
