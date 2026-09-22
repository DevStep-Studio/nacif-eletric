const ANEEL_API_URL = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";

export const ANEEL_MUNICIPALITY_RESOURCE = "3f841488-80a8-42f2-a6ca-e0c593b228de";
export const ANEEL_SET_ATTRIBUTES_RESOURCE = "3c780aca-38cf-406d-9d45-f07a9216eef2";
export const ANEEL_TARIFF_RESOURCE = "fcf2906c-7c32-4b9b-a637-054e7a5234f4";
export const ANEEL_TARIFF_SOURCE_URL =
  "https://dadosabertos.aneel.gov.br/dataset/tarifas-de-aplicacao-das-distribuidoras-de-energia-eletrica";
export const ANEEL_MUNICIPALITY_SOURCE_URL =
  "https://dadosabertos.aneel.gov.br/dataset/indicadores-de-qualidade-por-municipio";

const DISTRIBUTOR_PUBLIC_NAMES = {
  ELETROPAULO: "Enel Distribuição São Paulo",
  AMPLA: "Enel Distribuição Rio",
  COELCE: "Enel Distribuição Ceará",
  "CEMIG-D": "Cemig Distribuição",
  LIGHT: "Light",
  COELBA: "Neoenergia Coelba",
  CELPE: "Neoenergia Pernambuco",
  COSERN: "Neoenergia Cosern",
  ELEKTRO: "Neoenergia Elektro",
  BRASILIA: "Neoenergia Brasília",
};

const normalizeText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("pt-BR");

const parsePtBrNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const isDateInside = (date, start, end) => {
  const value = date.toISOString().slice(0, 10);
  return (!start || start <= value) && (!end || end >= value);
};

export function formatDistributorName(agent) {
  const code = String(agent || "").trim();
  return DISTRIBUTOR_PUBLIC_NAMES[code] || code;
}

export function selectDistributorCandidates(records = []) {
  const grouped = new Map();

  records.forEach((record) => {
    const agent = String(record?.SigAgente || "").trim();
    if (!agent) return;
    const year = Number(record?.AnoIndice) || 0;
    const current = grouped.get(agent) || { agent, latestYear: 0, occurrences: 0 };
    current.latestYear = Math.max(current.latestYear, year);
    current.occurrences += 1;
    grouped.set(agent, current);
  });

  return [...grouped.values()]
    .sort((left, right) => right.latestYear - left.latestYear || right.occurrences - left.occurrences)
    .map((item) => ({
      agent: item.agent,
      name: formatDistributorName(item.agent),
      latestYear: item.latestYear,
    }));
}

export function selectResidentialTariff(records = [], referenceDate = new Date()) {
  const eligible = records.filter((record) =>
    record?.DscSubGrupo === "B1"
    && record?.DscModalidadeTarifaria === "Convencional"
    && record?.DscClasse === "Residencial"
    && record?.DscSubClasse === "Residencial"
    && record?.DscDetalhe === "Não se aplica"
    && record?.DscUnidadeTerciaria === "MWh"
  );

  const current = eligible.filter((record) =>
    isDateInside(referenceDate, record.DatInicioVigencia, record.DatFimVigencia)
  );
  const ranked = (current.length ? current : eligible)
    .sort((left, right) => String(right.DatInicioVigencia).localeCompare(String(left.DatInicioVigencia)));
  const selected = ranked[0];
  if (!selected) return null;

  const tusdMwh = parsePtBrNumber(selected.VlrTUSD);
  const teMwh = parsePtBrNumber(selected.VlrTE);
  if (tusdMwh === null || teMwh === null) return null;

  return {
    valueBrlKwh: Math.round(((tusdMwh + teMwh) / 1000) * 100000) / 100000,
    tusdBrlMwh: tusdMwh,
    teBrlMwh: teMwh,
    startsAt: selected.DatInicioVigencia,
    endsAt: selected.DatFimVigencia,
    resolution: selected.DscREH,
    isCurrent: current.includes(selected),
  };
}

function jsonpDatastoreSearch(params, timeoutMs = 15000) {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Consulta ANEEL disponível apenas no navegador."));
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__aneel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const search = new URLSearchParams({
      resource_id: params.resourceId,
      limit: String(params.limit || 100),
      callback: callbackName,
    });

    if (params.filters) search.set("filters", JSON.stringify(params.filters));
    if (params.q) search.set("q", params.q);

    const cleanup = () => {
      window.clearTimeout(timer);
      script.remove();
      try { delete window[callbackName]; } catch { window[callbackName] = undefined; }
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("A consulta à ANEEL demorou mais que o esperado."));
    }, timeoutMs);

    window[callbackName] = (payload) => {
      cleanup();
      if (!payload?.success) {
        reject(new Error("A ANEEL não retornou dados válidos."));
        return;
      }
      resolve(payload.result);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Não foi possível consultar os dados públicos da ANEEL."));
    };
    script.src = `${ANEEL_API_URL}?${search.toString()}`;
    document.head.appendChild(script);
  });
}

async function findMunicipalityRecords(city, state) {
  const exact = await jsonpDatastoreSearch({
    resourceId: ANEEL_MUNICIPALITY_RESOURCE,
    filters: { NomMunicipio: city.trim(), SigUF: state.trim().toUpperCase() },
    limit: 500,
  });
  if (exact.records?.length) return exact.records;

  const broad = await jsonpDatastoreSearch({
    resourceId: ANEEL_MUNICIPALITY_RESOURCE,
    q: city.trim(),
    limit: 500,
  });
  return (broad.records || []).filter((record) =>
    normalizeText(record.NomMunicipio) === normalizeText(city)
    && String(record.SigUF || "").toUpperCase() === state.trim().toUpperCase()
  );
}

export async function resolveDistributorByMunicipality(city, state) {
  if (!city?.trim() || !state?.trim()) {
    return { candidates: [], confidence: "none" };
  }

  const municipalityRecords = await findMunicipalityRecords(city, state);
  const setIds = [...new Set(municipalityRecords.map((record) => record.IdeConjUnidConsumidoras).filter(Boolean))]
    .sort((left, right) => Number(right) - Number(left))
    .slice(0, 250);
  if (!setIds.length) return { candidates: [], confidence: "none" };

  const attributes = await jsonpDatastoreSearch({
    resourceId: ANEEL_SET_ATTRIBUTES_RESOURCE,
    filters: {
      IdeConjUndConsumidoras: setIds,
      SigIndicador: "ERP",
    },
    limit: 5000,
  });
  const candidates = selectDistributorCandidates(attributes.records || []);

  return {
    candidates,
    confidence: candidates.length === 1 ? "high" : candidates.length > 1 ? "medium" : "none",
  };
}

export async function resolveTariffForDistributor(agent, installationType = "Residencial") {
  if (!agent) return null;
  if (installationType !== "Residencial") {
    return {
      unsupported: true,
      message: "A tarifa automática exata exige confirmar grupo, modalidade e demanda desta unidade.",
    };
  }

  const result = await jsonpDatastoreSearch({
    resourceId: ANEEL_TARIFF_RESOURCE,
    filters: {
      SigAgente: agent,
      DscBaseTarifaria: "Tarifa de Aplicação",
      DscSubGrupo: "B1",
      DscModalidadeTarifaria: "Convencional",
      DscClasse: "Residencial",
    },
    limit: 500,
  }, 20000);
  return selectResidentialTariff(result.records || []);
}

export async function resolveEnergyContext({ city, state, installationType }) {
  const distributorResult = await resolveDistributorByMunicipality(city, state);
  if (distributorResult.candidates.length !== 1) {
    return { ...distributorResult, tariff: null };
  }

  const selected = distributorResult.candidates[0];
  const tariff = await resolveTariffForDistributor(selected.agent, installationType);
  return { ...distributorResult, selected, tariff };
}
