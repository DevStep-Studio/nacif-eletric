import assert from "node:assert/strict";
import { fetchAddressByCep } from "../src/lib/cepService.js";
import {
  geocodeByCepPrecise,
  searchAddressPrecise,
  parseBrazilianSearchInput,
} from "../src/lib/geocodingService.js";

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  console.log("🧪 Testando motor de geocodificação de CEP e endereços de alta precisão...");

  // 1. Parser
  assert.deepEqual(parseBrazilianSearchInput("26313240"), {
    kind: "cep",
    cep: "26313240",
    number: "",
    query: "26313240",
  });
  assert.deepEqual(parseBrazilianSearchInput("26313-240, 120"), {
    kind: "cep",
    cep: "26313240",
    number: "120",
    query: "26313-240, 120",
  });
  assert.equal(
    parseBrazilianSearchInput("Rua Marco Aurélio, Jardim Alzira, Queimados - RJ, 26313-240").kind,
    "cep_in_address"
  );

  // 2. Caso real crítico: 26313240 -> Rua Marco Aurélio, Jardim Alzira, Queimados - RJ
  const cepRes = await fetchAddressByCep("26313240");
  assert.equal(cepRes.success, true);
  assert.match(cepRes.data.address, /Marco Aur[eé]lio/i);
  assert.equal(cepRes.data.city, "Queimados");
  assert.equal(cepRes.data.state, "RJ");

  const queimadosGeo = await searchAddressPrecise("26313240");
  assert.ok(queimadosGeo.length > 0);
  const topQueimados = queimadosGeo[0];
  const distToRealStreet = haversineMeters(topQueimados.lat, topQueimados.lng, -22.71679, -43.57109);
  assert.ok(distToRealStreet < 150, `Esperado < 150m da Rua Marco Aurélio, obteve ${distToRealStreet.toFixed(1)}m`);
  assert.match(topQueimados.display_name, /Marco Aur[eé]lio/i);
  assert.match(topQueimados.display_name, /Queimados - RJ/);

  // 3. CEP + Número do imóvel
  const withNum = await searchAddressPrecise("26313-240, 120");
  assert.ok(withNum.length > 0);
  assert.equal(withNum[0].zoom, 20);
  assert.ok(haversineMeters(withNum[0].lat, withNum[0].lng, -22.7157, -43.57185) < 200);

  // 4. Amostra nacional multirregional
  const nationalCases = [
    { cep: "01310100", refLat: -23.56507, refLng: -46.65203, maxMeters: 350 },
    { cep: "22041080", refLat: -22.96858, refLng: -43.18853, maxMeters: 200 },
    { cep: "30140071", refLat: -19.92919, refLng: -43.93485, maxMeters: 250 },
    { cep: "80420090", refLat: -25.44245, refLng: -49.28780, maxMeters: 250 },
    { cep: "40026010", refLat: -12.97331, refLng: -38.51003, maxMeters: 250 },
    { cep: "23810000", refLat: -22.87209, refLng: -43.76277, maxMeters: 250 },
  ];

  for (const tc of nationalCases) {
    const res = await geocodeByCepPrecise(tc.cep);
    assert.ok(res, `Deve resolver CEP ${tc.cep}`);
    const errMeters = haversineMeters(res.lat, res.lng, tc.refLat, tc.refLng);
    assert.ok(errMeters <= tc.maxMeters, `CEP ${tc.cep} excedeu tolerância: ${errMeters.toFixed(1)}m`);
  }

  console.log("✅ cep-geocoding-precision-smoke: OK");
}

main().catch((err) => {
  console.error("FALHA cep-geocoding-precision-smoke:", err);
  process.exit(1);
});
