/**
 * solarDistributorRates.js — Base de Concessionárias de Energia e Tarifas Regulatórias ANEEL por Localização
 *
 * Mapeia Estados (UF), Cidades e Faixas de CEP para:
 * 1. Distribuidora de energia responsável pela concessão.
 * 2. Tarifa média regulatória de referência B1 Residencial (R$/kWh).
 * 3. Irradiação solar média típica (HSP - kWh/m².dia).
 */

export const BRAZILIAN_REGULATORY_DISTRIBUTORS = [
  // São Paulo (SP)
  {
    key: "enel_sp",
    name: "Enel SP",
    state: "SP",
    referenceTariffBrlKwh: 0.92,
    hspDaily: 4.85,
    cities: ["São Paulo", "São Bernardo do Campo", "Santo André", "Osasco", "Guarulhos", "Mauá", "Diadema", "Barueri", "Carapicuíba", "Taboão da Serra", "Embu das Artes", "Itapevi", "Cotia", "Santana de Parnaíba", "Itapecerica da Serra", "Franco da Rocha", "Francisco Morato", "Caieiras", "Mairiporã", "Ribeirão Pires", "Rio Grande da Serra", "Jandira", "Vargem Grande Paulista", "Juquitiba", "São Lourenço da Serra"],
    cepRanges: [[1000000, 9999999]],
  },
  {
    key: "cpfl_paulista",
    name: "CPFL Paulista",
    state: "SP",
    referenceTariffBrlKwh: 0.95,
    hspDaily: 5.10,
    cities: ["Campinas", "Ribeirão Preto", "Piracicaba", "Bauru", "São José do Rio Preto", "Franca", "Araraquara", "São Carlos", "Americana", "Hortolândia", "Sumaré", "Indaiatuba", "Santa Bárbara d'Oeste", "Araçatuba", "Marília", "Presidente Prudente", "Jaú", "Botucatu", "Barretos", "Catanduva"],
    cepRanges: [[13000000, 14999999], [15000000, 19999999]],
  },
  {
    key: "neoenergia_elektro",
    name: "Neoenergia Elektro",
    state: "SP",
    referenceTariffBrlKwh: 0.94,
    hspDaily: 4.95,
    cities: ["Limeira", "Rio Claro", "Araras", "Guarujá", "Bertioga", "Ubatuba", "Caraguatatuba", "São Sebastião", "Ilhabela", "Atibaia", "Bragança Paulista", "Tatuí", "Itapetininga", "Registro", "Campos do Jordão", "Cruzeiro", "Pindamonhangaba", "Guaratinguetá", "Lorena", "Taubaté"],
  },
  {
    key: "cpfl_piratininga",
    name: "CPFL Piratininga",
    state: "SP",
    referenceTariffBrlKwh: 0.93,
    hspDaily: 4.90,
    cities: ["Santos", "São Vicente", "Praia Grande", "Cubatão", "Sorocaba", "Jundiaí", "Votorantim", "Itu", "Salto", "Vinhedo", "Valinhos", "Louveira", "Ibiúna", "São Roque"],
  },

  // Rio de Janeiro (RJ)
  {
    key: "light",
    name: "Light",
    state: "RJ",
    referenceTariffBrlKwh: 1.12,
    hspDaily: 4.90,
    cities: ["Rio de Janeiro", "Nova Iguaçu", "Duque de Caxias", "São João de Meriti", "Belford Roxo", "Nilópolis", "Mesquita", "Queimados", "Japeri", "Paracambi", "Seropédica", "Itaguaí", "Piraí", "Barra do Piraí", "Volta Redonda", "Barra Mansa", "Resende", "Valença", "Três Rios"],
    cepRanges: [[20000000, 23799999], [26000000, 27399999]],
  },
  {
    key: "enel_rj",
    name: "Enel RJ",
    state: "RJ",
    referenceTariffBrlKwh: 1.15,
    hspDaily: 5.05,
    cities: ["Niterói", "São Gonçalo", "Itaboraí", "Maricá", "Petrópolis", "Teresópolis", "Nova Friburgo", "Cabo Frio", "Armação dos Búzios", "Arraial do Cabo", "Macaé", "Campos dos Goytacazes", "Angra dos Reis", "Paraty", "Rio das Ostras", "Saquarema", "Araruama"],
    cepRanges: [[23800000, 25999999], [27400000, 28999999]],
  },

  // Minas Gerais (MG)
  {
    key: "cemig",
    name: "Cemig",
    state: "MG",
    referenceTariffBrlKwh: 0.98,
    hspDaily: 5.15,
    cities: ["Belo Horizonte", "Contagem", "Betim", "Uberlândia", "Juiz de Fora", "Montes Claros", "Uberaba", "Governador Valadares", "Ipatinga", "Sete Lagoas", "Divinópolis", "Santa Luzia", "Ibirité", "Poços de Caldas", "Pouso Alegre", "Varginha", "Conselheiro Lafaiete", "Barbacena"],
    cepRanges: [[30000000, 39999999]],
  },

  // Distrito Federal (DF)
  {
    key: "neoenergia_brasilia",
    name: "Neoenergia Brasília",
    state: "DF",
    referenceTariffBrlKwh: 0.88,
    hspDaily: 5.25,
    cities: ["Brasília", "Ceilândia", "Taguatinga", "Samambaia", "Plano Piloto", "Águas Claras", "Guará", "Gama", "Sobradinho", "Planaltina", "Recanto das Emas", "Santa Maria", "São Sebastião", "Vicente Pires"],
    cepRanges: [[70000000, 73699999]],
  },

  // Bahia (BA)
  {
    key: "neoenergia_coelba",
    name: "Neoenergia Coelba",
    state: "BA",
    referenceTariffBrlKwh: 0.96,
    hspDaily: 5.40,
    cities: ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Juazeiro", "Itabuna", "Lauro de Freitas", "Ilhéus", "Jequié", "Teixeira de Freitas", "Barreiras", "Alagoinhas", "Porto Seguro", "Simões Filho", "Paulo Afonso", "Eunápolis", "Santo Antônio de Jesus"],
    cepRanges: [[40000000, 48999999]],
  },

  // Paraná (PR)
  {
    key: "copel",
    name: "Copel",
    state: "PR",
    referenceTariffBrlKwh: 0.86,
    hspDaily: 4.75,
    cities: ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "São José dos Pinhais", "Foz do Iguaçu", "Colombo", "Guarapuava", "Paranaguá", "Araucária", "Toledo", "Apucarana", "Pinhais", "Campo Largo", "Arapongas", "Almirante Tamandaré", "Umuarama"],
    cepRanges: [[80000000, 87999999]],
  },

  // Santa Catarina (SC)
  {
    key: "celesc",
    name: "Celesc",
    state: "SC",
    referenceTariffBrlKwh: 0.84,
    hspDaily: 4.60,
    cities: ["Florianópolis", "Joinville", "Blumenau", "São José", "Chapecó", "Itajaí", "Criciúma", "Jaraguá do Sul", "Palhoça", "Lages", "Balneário Camboriú", "Brusque", "Tubarão", "São Bento do Sul", "Caçador"],
    cepRanges: [[88000000, 89999999]],
  },

  // Rio Grande do Sul (RS)
  {
    key: "rge",
    name: "RGE Sul",
    state: "RS",
    referenceTariffBrlKwh: 0.97,
    hspDaily: 4.65,
    cities: ["Porto Alegre", "Caxias do Sul", "Canoas", "Pelotas", "Santa Maria", "Gravataí", "Viamão", "Novo Hamburgo", "São Leopoldo", "Rio Grande", "Alvorada", "Passo Fundo", "Sapucaia do Sul", "Uruguaiana", "Santa Cruz do Sul", "Bento Gonçalves"],
    cepRanges: [[90000000, 99999999]],
  },

  // Goiás (GO)
  {
    key: "equatorial_go",
    name: "Equatorial Goiás",
    state: "GO",
    referenceTariffBrlKwh: 0.91,
    hspDaily: 5.30,
    cities: ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Rio Verde", "Águas Lindas de Goiás", "Luziânia", "Valparaíso de Goiás", "Trindade", "Formosa", "Novo Gama", "Senador Canedo", "Itumbiara", "Catalão", "Jataí", "Planaltina"],
    cepRanges: [[72800000, 72999999], [73700000, 76799999]],
  },

  // Pernambuco (PE)
  {
    key: "neoenergia_pe",
    name: "Neoenergia Pernambuco",
    state: "PE",
    referenceTariffBrlKwh: 0.93,
    hspDaily: 5.35,
    cities: ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru", "Petrolina", "Paulista", "Cabo de Santo Agostinho", "Camaragibe", "Garanhuns", "Vitória de Santo Antão", "Igarassu", "São Lourenço da Mata", "Abreu e Lima"],
    cepRanges: [[50000000, 56999999]],
  },

  // Ceará (CE)
  {
    key: "enel_ce",
    name: "Enel Ceará",
    state: "CE",
    referenceTariffBrlKwh: 0.99,
    hspDaily: 5.50,
    cities: ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Maracanaú", "Sobral", "Crato", "Itapipoca", "Maranguape", "Iguatu", "Quixadá", "Canindé", "Aquiraz", "Pacatuba", "Crateús", "Russas"],
    cepRanges: [[60000000, 63999999]],
  },

  // Pará (PA)
  {
    key: "equatorial_pa",
    name: "Equatorial Pará",
    state: "PA",
    referenceTariffBrlKwh: 1.08,
    hspDaily: 4.80,
    cities: ["Belém", "Ananindeua", "Santarém", "Marabá", "Parauapebas", "Castanhal", "Abaetetuba", "Cametá", "Marituba", "Bragança", "São Félix do Xingu", "Barcarena", "Altamira", "Tucuruí", "Paragominas"],
    cepRanges: [[66000000, 68899999]],
  },

  // Maranhão (MA)
  {
    key: "equatorial_ma",
    name: "Equatorial Maranhão",
    state: "MA",
    referenceTariffBrlKwh: 0.99,
    hspDaily: 5.10,
    cities: ["São Luís", "Imperatriz", "São José de Ribamar", "Timon", "Caxias", "Codó", "Paço do Lumiar", "Açailândia", "Bacabal", "Balsas", "Santa Inês", "Barra do Corda", "Pinheiro", "Chapadinha"],
    cepRanges: [[65000000, 65999999]],
  },

  // Mato Grosso (MT)
  {
    key: "energisa_mt",
    name: "Energisa",
    state: "MT",
    referenceTariffBrlKwh: 1.04,
    hspDaily: 5.20,
    cities: ["Cuiabá", "Várzea Grande", "Rondonópolis", "Sinop", "Tangará da Serra", "Sorriso", "Lucas do Rio Verde", "Primavera do Leste", "Barra do Garças", "Cáceres", "Alta Floresta", "Nova Mutum"],
    cepRanges: [[78000000, 78899999]],
  },

  // Mato Grosso do Sul (MS)
  {
    key: "energisa_ms",
    name: "Energisa",
    state: "MS",
    referenceTariffBrlKwh: 1.06,
    hspDaily: 5.15,
    cities: ["Campo Grande", "Dourados", "Três Lagoas", "Corumbá", "Ponta Porã", "Naviraí", "Nova Andradina", "Sidrolândia", "Aquidauana", "Maracaju", "Paranaíba", "Amambai"],
    cepRanges: [[79000000, 79999999]],
  },

  // Espírito Santo (ES)
  {
    key: "edp_es",
    name: "EDP Espírito Santo",
    state: "ES",
    referenceTariffBrlKwh: 0.89,
    hspDaily: 4.95,
    cities: ["Vitória", "Vila Velha", "Serra", "Cariacica", "Cachoeiro de Itapemirim", "Linhares", "São Mateus", "Guarapari", "Colatina", "Aracruz", "Viana", "Nova Venécia"],
    cepRanges: [[29000000, 29999999]],
  },

  // Rio Grande do Norte (RN)
  {
    key: "neoenergia_cosern",
    name: "Neoenergia Cosern",
    state: "RN",
    referenceTariffBrlKwh: 0.92,
    hspDaily: 5.60,
    cities: ["Natal", "Mossoró", "Parnamirim", "São Gonçalo do Amarante", "Macaíba", "Ceará-Mirim", "Caicó", "Açu", "Currais Novos", "São José de Mipibu", "Santa Cruz"],
    cepRanges: [[59000000, 59999999]],
  },

  // Paraíba (PB)
  {
    key: "energisa_pb",
    name: "Energisa",
    state: "PB",
    referenceTariffBrlKwh: 0.91,
    hspDaily: 5.45,
    cities: ["João Pessoa", "Campina Grande", "Santa Rita", "Patos", "Bayeux", "Sousa", "Cajazeiras", "Cabedelo", "Guarabira", "Mamanguape", "Queimadas"],
    cepRanges: [[58000000, 58999999]],
  },

  // Alagoas (AL)
  {
    key: "equatorial_al",
    name: "Equatorial Alagoas",
    state: "AL",
    referenceTariffBrlKwh: 0.96,
    hspDaily: 5.30,
    cities: ["Maceió", "Arapiraca", "Rio Largo", "Palmeira dos Índios", "União dos Palmares", "Penedo", "São Miguel dos Campos", "Campo Alegre", "Coruripe", "Delmiro Gouveia"],
    cepRanges: [[57000000, 57999999]],
  },

  // Piauí (PI)
  {
    key: "equatorial_pi",
    name: "Equatorial Piauí",
    state: "PI",
    referenceTariffBrlKwh: 0.97,
    hspDaily: 5.40,
    cities: ["Teresina", "Parnaíba", "Picos", "Piripiri", "Floriano", "Barras", "Campo Maior", "União", "Altos", "Esperantina", "José de Freitas", "Pedro II"],
    cepRanges: [[64000000, 64999999]],
  },

  // Sergipe (SE)
  {
    key: "energisa_se",
    name: "Energisa",
    state: "SE",
    referenceTariffBrlKwh: 0.89,
    hspDaily: 5.35,
    cities: ["Aracaju", "Nossa Senhora do Socorro", "Lagarto", "Itabaiana", "São Cristóvão", "Estância", "Tobias Barreto", "Simão Dias", "Nossa Senhora da Glória", "Poço Redondo"],
    cepRanges: [[49000000, 49999999]],
  },

  // Tocantins (TO)
  {
    key: "energisa_to",
    name: "Energisa",
    state: "TO",
    referenceTariffBrlKwh: 1.02,
    hspDaily: 5.30,
    cities: ["Palmas", "Araguaína", "Gurupi", "Porto Nacional", "Paraíso do Tocantins", "Araguatins", "Colinas do Tocantins", "Guaraí", "Tocantinópolis", "Dianópolis"],
    cepRanges: [[77000000, 77999999]],
  },

  // Rondônia (RO)
  {
    key: "energisa_ro",
    name: "Energisa",
    state: "RO",
    referenceTariffBrlKwh: 1.05,
    hspDaily: 4.80,
    cities: ["Porto Velho", "Ji-Paraná", "Ariquemes", "Vilhena", "Cacoal", "Rolim de Moura", "Jaru", "Guajará-Mirim", "Ouro Preto do Oeste", "Pimenta Bueno"],
    cepRanges: [[76800000, 76999999]],
  },

  // Acre (AC)
  {
    key: "energisa_ac",
    name: "Energisa",
    state: "AC",
    referenceTariffBrlKwh: 1.09,
    hspDaily: 4.70,
    cities: ["Rio Branco", "Cruzeiro do Sul", "Sena Madureira", "Tarauacá", "Feijó", "Brasiléia", "Senador Guiomard", "Plácido de Castro", "Xapuri"],
    cepRanges: [[69900000, 69999999]],
  },

  // Amazonas (AM)
  {
    key: "amazonas_energia",
    name: "Amazonas Energia",
    state: "AM",
    referenceTariffBrlKwh: 1.04,
    hspDaily: 4.65,
    cities: ["Manaus", "Parintins", "Itacoatiara", "Manacapuru", "Coari", "Tabatinga", "Maués", "Tefé", "Manicoré", "Humaitá", "Iranduba"],
    cepRanges: [[69000000, 69299999], [69400000, 69899999]],
  },

  // Amapá (AP)
  {
    key: "cea_equatorial",
    name: "CEA Equatorial",
    state: "AP",
    referenceTariffBrlKwh: 0.95,
    hspDaily: 4.75,
    cities: ["Macapá", "Santana", "Laranjal do Jari", "Oiapoque", "Porto Grande", "Mazagão", "Tartarugalzinho", "Pedra Branca do Amapari"],
    cepRanges: [[68900000, 68999999]],
  },

  // Roraima (RR)
  {
    key: "roraima_energia",
    name: "Roraima Energia",
    state: "RR",
    referenceTariffBrlKwh: 1.02,
    hspDaily: 5.00,
    cities: ["Boa Vista", "Rorainópolis", "Caracaraí", "Pacaraima", "Cantá", "Mucajaí", "Alto Alegre"],
    cepRanges: [[69300000, 69399999]],
  },
];

function normalizeStr(s = "") {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Identifica com precisão a distribuidora de energia e tarifa de referência com base na localização informada.
 */
export function identifyDistributorByLocation({ state = "", city = "", zip_code = "", address = "" } = {}) {
  const normState = (state || "").toString().trim().toUpperCase();
  const normCity = normalizeStr(city);
  const cleanZip = String(zip_code || "").replace(/\D/g, "");
  const zipNum = cleanZip.length >= 5 ? parseInt(cleanZip.padEnd(8, "0"), 10) : null;

  // 1. Tenta correspondência direta por Cidade + Estado (Maior precisão)
  if (normState && normCity) {
    const stateMatches = BRAZILIAN_REGULATORY_DISTRIBUTORS.filter((d) => d.state === normState);
    
    // Procura distribuidora que liste especificamente essa cidade
    for (const dist of stateMatches) {
      if (dist.cities && dist.cities.some((c) => normalizeStr(c) === normCity || normCity.includes(normalizeStr(c)))) {
        return {
          distributor: dist.name,
          state: dist.state,
          referenceTariffBrlKwh: dist.referenceTariffBrlKwh,
          hspDaily: dist.hspDaily,
          confidence: "high",
          source: "concession_city_match",
          notes: `Área de concessão atendida por ${dist.name}. Tarifa média residencial ANEEL: R$ ${dist.referenceTariffBrlKwh.toFixed(2).replace(".", ",")}/kWh.`,
        };
      }
    }

    // Se o estado tiver apenas 1 distribuidora principal (ex: MG -> Cemig, PR -> Copel, SC -> Celesc, DF -> Neoenergia Brasília)
    if (stateMatches.length === 1) {
      const dist = stateMatches[0];
      return {
        distributor: dist.name,
        state: dist.state,
        referenceTariffBrlKwh: dist.referenceTariffBrlKwh,
        hspDaily: dist.hspDaily,
        confidence: "high",
        source: "state_monopoly",
        notes: `Concessionária estadual: ${dist.name}. Tarifa de referência: R$ ${dist.referenceTariffBrlKwh.toFixed(2).replace(".", ",")}/kWh.`,
      };
    }
  }

  // 2. Tenta por faixa de CEP
  if (zipNum) {
    for (const dist of BRAZILIAN_REGULATORY_DISTRIBUTORS) {
      if (dist.cepRanges) {
        for (const [minCep, maxCep] of dist.cepRanges) {
          if (zipNum >= minCep && zipNum <= maxCep) {
            return {
              distributor: dist.name,
              state: dist.state,
              referenceTariffBrlKwh: dist.referenceTariffBrlKwh,
              hspDaily: dist.hspDaily,
              confidence: "high",
              source: "cep_range",
              notes: `Identificado pelo CEP na concessão de ${dist.name}.`,
            };
          }
        }
      }
    }
  }

  // 3. Fallback por Estado
  if (normState) {
    const stateMatches = BRAZILIAN_REGULATORY_DISTRIBUTORS.filter((d) => d.state === normState);
    if (stateMatches.length > 0) {
      const dist = stateMatches[0];
      return {
        distributor: dist.name,
        state: dist.state,
        referenceTariffBrlKwh: dist.referenceTariffBrlKwh,
        hspDaily: dist.hspDaily,
        confidence: stateMatches.length === 1 ? "high" : "medium",
        source: "state_fallback",
        notes: `Principal concessionária de ${normState}: ${dist.name}. Confirme ou altere se necessário.`,
      };
    }
  }

  return null;
}
