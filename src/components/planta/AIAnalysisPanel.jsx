import { useState } from "react";
import { backend } from "@/api/backendClient";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Zap, Cable, ScanLine, FileText } from "lucide-react";
import { buildAiRequestedPlan, buildProfessionalPlanAnalysis } from "@/lib/professionalElectricalPlanLibrary";

const safeArray = (value) => Array.isArray(value) ? value : [];

export default function AIAnalysisPanel({
  imageUrl,
  points,
  onRequestedPlanGenerated,
  onMountedRoomsRequested,
  onPointsSuggested,
  onInfrastructureGenerated,
  onProjectCircuitsRequested,
  onFullScanCompleted,
  projectCircuits = [],
  hasPositionedBoard = false,
  selectedProjectId = "",
  infraType = "embutido",
  setInfraType = () => {},
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [notice, setNotice]   = useState(null);
  const [step, setStep]       = useState("");
  const [requestText, setRequestText] = useState("");


  const pointCount = safeArray(points).length;
  const projectCircuitCount = safeArray(projectCircuits).length;
  const projectCircuitsSummary = safeArray(projectCircuits)
    .map((circuit, index) => `${circuit.name || `Circuito ${index + 1}`} (${circuit.type || "tipo nao informado"}, ${circuit.power_w || circuit.load_w_total || 0}W)`)
    .join("; ");

  const hasUsefulPlanData = (analysis) => (
    safeArray(analysis?.suggested_points).length > 0
  );

  const hasUsefulScannerData = (analysis) => (
    hasUsefulPlanData(analysis)
    || safeArray(analysis?.budget_items).length > 0
    || Object.keys(analysis?.detected_counts || {}).length > 0
  );

  const applyPlan = (analysis, options = {}) => {
    const {
      applyPoints = true,
      applyInfrastructure = true,
      applyInfrastructurePoints = true,
      mergeResult = false,
    } = options;

    setResult(prev => mergeResult ? { ...(prev || {}), ...(analysis || {}) } : analysis);

    const suggested = safeArray(analysis?.suggested_points);
    const infrastructure = applyInfrastructurePoints ? safeArray(analysis?.infrastructure) : [];
    if (applyPoints && (suggested.length > 0 || infrastructure.length > 0) && onPointsSuggested) {
      onPointsSuggested([...suggested, ...infrastructure]);
    }

    if (applyInfrastructure && safeArray(analysis?.routes).length > 0 && onInfrastructureGenerated) {
      onInfrastructureGenerated({ routes: analysis.routes });
    }
  };

  const getMountedRooms = () => safeArray(onMountedRoomsRequested?.());

  const buildLocalPlan = (options = {}) => buildProfessionalPlanAnalysis({
    points: safeArray(points),
    rooms: safeArray(options.rooms),
    includeSuggestedPoints: options.includeSuggestedPoints ?? pointCount === 0,
    infraType: options.infraType ?? infraType,
  });

  const countAnalysisItems = (analysis = {}) => {
    const counts = {
      ambientes: safeArray(analysis.rooms).length,
      pontos: safeArray(analysis.suggested_points).reduce((total, point) => total + (Number(point.quantity) || 1), 0),
      iluminacao: 0,
      tomadas: 0,
      forca: 0,
      interruptores: 0,
      quadros: 0,
      caixas: 0,
      rotas: safeArray(analysis.routes).length,
    };

    safeArray(analysis.suggested_points).forEach((point) => {
      const type = String(point.type || "").toLowerCase();
      const quantity = Number(point.quantity) || 1;
      if (["luminaria", "spot", "arandela"].includes(type)) counts.iluminacao += quantity;
      if (type === "tug") counts.tomadas += quantity;
      if (["tue", "chuveiro", "arcond", "motor"].includes(type)) counts.forca += quantity;
      if (type.includes("interruptor") || type.startsWith("inter")) counts.interruptores += quantity;
    });

    safeArray(analysis.infrastructure).forEach((item) => {
      const type = String(item.type || "").toLowerCase();
      const quantity = Number(item.quantity) || 1;
      if (["qe", "qgbt", "quadro"].includes(type)) counts.quadros += quantity;
      if (type.includes("caixa")) counts.caixas += quantity;
    });

    return { ...counts, ...(analysis.detected_counts || {}) };
  };

  const fallbackBudgetFromAnalysis = (analysis = {}) => {
    const counts = countAnalysisItems(analysis);
    const routeCount = Math.max(1, counts.rotas || safeArray(analysis.routes).length);
    const conduitMeters = Math.max(20, Number(counts.eletroduto_m || counts.conduit_m) || routeCount * 8);
    const items = [
      { name: infraType === "galvanizado" ? "Eletroduto galvanizado 3/4\"" : "Eletroduto corrugado PVC 3/4\"", qty: conduitMeters, unit: "m", unit_price: infraType === "galvanizado" ? 18.5 : 2.8, category: "infraestrutura" },
      { name: "Cabo flexivel 1.5mm2 - iluminacao", qty: Math.max(50, counts.iluminacao * 18), unit: "m", unit_price: 1.45, category: "cabos" },
      { name: "Cabo flexivel 2.5mm2 - tomadas/forca", qty: Math.max(100, (counts.tomadas + counts.forca) * 16), unit: "m", unit_price: 2.3, category: "cabos" },
      { name: "Caixa 4x2 / passagem", qty: Math.max(5, counts.tomadas + counts.interruptores + counts.caixas), unit: "un", unit_price: infraType === "galvanizado" ? 22 : 4.5, category: "infraestrutura" },
      { name: "Modulo tomada 2P+T", qty: Math.max(0, counts.tomadas), unit: "un", unit_price: 12, category: "acabamento" },
      { name: "Modulo interruptor", qty: Math.max(0, counts.interruptores), unit: "un", unit_price: 14, category: "acabamento" },
      { name: "Quadro de distribuicao DIN", qty: Math.max(1, counts.quadros), unit: "un", unit_price: 180, category: "quadros" },
    ];
    return items.filter((item) => item.qty > 0);
  };

  const buildScannerReport = (analysis = {}) => {
    const budgetItems = safeArray(analysis.budget_items).length > 0
      ? safeArray(analysis.budget_items)
      : fallbackBudgetFromAnalysis(analysis);
    const total = budgetItems.reduce((sum, item) => {
      const price = Number(item.unit_price ?? item.pricePerUnit ?? item.price) || 0;
      return sum + (Number(item.qty || item.quantity) || 0) * price;
    }, 0);
    return {
      generated_at: new Date().toISOString(),
      source: imageUrl ? "ia-imagem" : "biblioteca-local",
      infraType,
      counts: countAnalysisItems(analysis),
      budget_items: budgetItems,
      budget_total: total,
      notes: analysis.notes || "",
    };
  };

  const buildRoomBasedPlan = (options = {}) => {
    const rooms = getMountedRooms();
    if (rooms.length === 0) {
      setError("Monte ou nomeie os cômodos no quadro antes de gerar com IA. A IA não vai criar cômodos automaticamente.");
      setResult(null);
      return null;
    }
    return buildLocalPlan({
      ...options,
      rooms,
      includeSuggestedPoints: options.includeSuggestedPoints ?? true,
      infraType: options.infraType ?? infraType,
    });
  };

  const generateRequestedPlan = () => {
    const text = requestText.trim();
    setError(null);
    setNotice(null);
    if (!text) {
      setError("Digite o pedido da planta antes de gerar.");
      return;
    }

    const plan = buildAiRequestedPlan(text, infraType);
    if (safeArray(plan.rooms).length === 0) {
      setError(plan.notes || "Informe pelo menos os cômodos desejados.");
      return;
    }

    const planForCanvas = { ...plan, circuits: [], infrastructure: [], routes: [] };
    setResult(planForCanvas);
    setNotice(`Pedido gerado no quadro: ${plan.rooms.length} cômodo(s) e ${safeArray(plan.suggested_points).length} ponto(s). Circuitos devem vir do Editor de Circuitos.`);
    onRequestedPlanGenerated?.(planForCanvas);
  };

  const analyzeWithAI = async () => {
    if (!imageUrl) { setError("Importe uma planta baixa primeiro."); return; }
    setLoading(true); setError(null); setNotice(null); setResult(null);

    try {
      setStep("Analisando arquitetura da planta...");
      const analysis = /** @type {any} */ (await backend.integrations.Core.InvokeLLM({
        prompt: `Você é um engenheiro elétrico especialista em NBR 5410.
Analise esta planta baixa e retorne um JSON com:
- rooms: array de ambientes identificados (nome, tipo: quarto/banheiro/cozinha/sala/área_molhada/etc, estimativa de área)
- suggested_points: array de pontos elétricos sugeridos para cada ambiente com:
  type (tug/tue/luminaria/spot/arandela/interruptor/inter2/inter3/inter3way/arcond/chuveiro), label, quantity, load_w, circuit_type, room, x_pct, y_pct
- nao gere circuitos novos. Os circuitos oficiais devem vir do Editor de Circuitos do projeto.
- infrastructure: array de infraestrutura sugerida:
  type (qe/caixa/eletroduto), label, room, x_pct, y_pct, description
- routes: array de rotas de eletroduto/infraestrutura com:
  label, circuit_name, system_type (eletrica/telecom), conduit_diameter (3/4", 1", 1 1/4", 1 1/2", 2", 3" ou 4"), path [{x_pct, y_pct}], description
- notes: observações NBR 5410

Critérios obrigatórios:
- O usuário escolheu o tipo de instalação de infraestrutura: ${infraType === "galvanizado" ? "Sobrepor com estrutura galvanizada (eletrodutos de aço galvanizado aparentes e caixas de sobreposição condulete)" : "Embutido (eletrodutos flexíveis embutidos em alvenaria de parede/teto)"}.
- Luminárias e interruptores devem ser sugeridos para todos os ambientes.
- Para iluminação, a rota deve sair do quadro/QD para o interruptor do ambiente e depois seguir para a(s) luminária(s); não ligue cada luminária individualmente direto ao QD quando houver interruptor.
- Tomadas TUG devem ser ligadas em série dentro do mesmo circuito/ambiente, uma tomada após a outra até chegar ao QD, evitando rotas individuais de cada tomada direto ao QD.
- Ar-condicionado, chuveiro, motor e TUE devem ir direto ao QD em circuito dedicado.
- Circuitos de iluminação usam cabo mínimo 1.5mm².
- Tomadas, TUE e circuitos de força usam cabo mínimo 2.5mm².
- Prever quadro elétrico, caixas de passagem e rotas principais de eletroduto.
- Não crie cômodos que não existam na planta.
- Se não conseguir identificar os ambientes, retorne arrays vazios e explique em notes que o usuário deve montar/nomear os cômodos no quadro.`,
        file_urls: [imageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            rooms: { type: "array", items: { type: "object", properties: {
              name: { type: "string" }, type: { type: "string" }, area_m2: { type: "number" }
            }}},
            suggested_points: { type: "array", items: { type: "object", properties: {
              type: { type: "string" }, label: { type: "string" }, quantity: { type: "number" },
              load_w: { type: "number" }, circuit_type: { type: "string" }, room: { type: "string" },
              x_pct: { type: "number" }, y_pct: { type: "number" }
            }}},
            circuits: { type: "array", items: { type: "object", properties: {
              name: { type: "string" }, type: { type: "string" }, load_w_total: { type: "number" },
              supply_type: { type: "string" }, voltage: { type: "number" }, phase: { type: "string" },
              point_count: { type: "number" }, length_m: { type: "number" }
            }}},
            infrastructure: { type: "array", items: { type: "object", properties: {
              type: { type: "string" }, label: { type: "string" }, room: { type: "string" },
              x_pct: { type: "number" }, y_pct: { type: "number" }, description: { type: "string" }
            }}},
            routes: { type: "array", items: { type: "object", properties: {
              label: { type: "string" }, circuit_name: { type: "string" }, system_type: { type: "string" }, conduit_diameter: { type: "string" }, description: { type: "string" },
              path: { type: "array", items: { type: "object", properties: {
                x_pct: { type: "number" }, y_pct: { type: "number" }
              }}}
            }}},
            notes: { type: "string" }
          }
        }
      }));
      if (hasUsefulPlanData(analysis)) {
        applyPlan(
          { ...analysis, circuits: [], infrastructure: [], routes: [] },
          { applyCircuits: false, applyInfrastructure: false, applyInfrastructurePoints: false }
        );
      } else {
        const localPlan = buildRoomBasedPlan({ includeSuggestedPoints: true, infraType });
        if (!localPlan) return;
        setNotice("A IA remota nao retornou dados aproveitaveis. Usei os comodos montados no quadro para gerar a proposta NBR.");
        applyPlan(
          { ...localPlan, circuits: [], infrastructure: [], routes: [] },
          { applyCircuits: false, applyInfrastructure: false, applyInfrastructurePoints: false }
        );
      }
    } catch (e) {
      const localPlan = buildRoomBasedPlan({ includeSuggestedPoints: true, infraType });
      if (!localPlan) return;
      setNotice(`IA remota indisponivel (${e.message || "sem resposta"}). Usei os comodos montados no quadro como fallback.`);
      applyPlan(
        { ...localPlan, circuits: [], infrastructure: [], routes: [] },
        { applyCircuits: false, applyInfrastructure: false, applyInfrastructurePoints: false }
      );
    } finally {
      setLoading(false); setStep("");
    }
  };

  const pullProjectCircuits = async () => {
    setError(null);
    setNotice(null);
    if (!selectedProjectId || !onProjectCircuitsRequested) {
      setError("Selecione ou crie um projeto antes de puxar os circuitos.");
      return;
    }

    setLoading(true);
    setStep("Puxando circuitos do Editor de Circuitos...");
    try {
      const count = await onProjectCircuitsRequested();
      if (count > 0) {
        setNotice(`${count} circuito(s) carregado(s) do Editor de Circuitos. Agora posicione o QD e gere a infraestrutura.`);
      } else {
        setError("Nenhum circuito cadastrado no projeto. Abra o Editor de Circuitos e cadastre os circuitos primeiro.");
      }
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  const generateInfrastructure = async () => {
    setError(null);
    setNotice(null);
    if (projectCircuitCount === 0) {
      setError("Crie os circuitos no Editor de Circuitos e puxe para a planta antes de gerar infraestrutura.");
      return;
    }
    if (!hasPositionedBoard) {
      setError("Posicione o quadro elétrico (QD) na planta antes de direcionar a infraestrutura com IA.");
      return;
    }

    setLoading(true);

    try {
      if (pointCount === 0 && !imageUrl) {
        setStep("Lendo comodos montados para infraestrutura...");
        const localPlan = buildRoomBasedPlan({ includeSuggestedPoints: true, infraType });
        if (!localPlan) return;
        setNotice(`Apliquei infraestrutura sobre ${localPlan.rooms.length} comodo(s) montado(s), sem criar comodos novos.`);
        applyPlan(localPlan);
        return;
      }

      setStep("Projetando infraestrutura da planta...");
      const pointsSummary = pointCount > 0
        ? safeArray(points).map(p => `${p.label} (${p.type}) em x=${Math.round(p.x)}%, y=${Math.round(p.y)}%`).join("; ")
        : "sem pontos manuais; usar somente cômodos existentes ou retornar vazio";
      const gen = /** @type {any} */ (await backend.integrations.Core.InvokeLLM({
        prompt: `Você é um engenheiro eletricista especialista em NBR 5410 e lançamento de infraestrutura em planta baixa.
Com base nos pontos marcados: ${pointsSummary}
Circuitos oficiais vindos do Editor de Circuitos: ${projectCircuitsSummary || "circuitos cadastrados no projeto"}.

Gere infraestrutura executiva para a planta:
- O usuário escolheu o tipo de instalação: ${infraType === "galvanizado" ? "Sobrepor com estrutura galvanizada (eletrodutos de aço galvanizado aparentes e caixas condulete). As rotas de eletroduto devem ser representadas por trajetos ortogonais (retos com curvas de 90 graus)." : "Embutido (eletrodutos flexíveis embutidos em alvenaria de parede/teto). As rotas de eletroduto podem ser curvas ou arcos direto do interruptor/tomada para o ponto de teto."}.
- use o quadro elétrico (QD) já posicionado na planta como origem principal
- caixas de passagem para reduzir trechos longos
- rotas de eletrodutos devem seguir os circuitos oficiais listados acima
- cada rota deve informar system_type como eletrica ou telecom; eletrica sera preta e telecom azul
- cada rota deve informar conduit_diameter em polegadas: 3/4", 1", 1 1/4", 1 1/2", 2", 3" ou 4"
- iluminação deve sair do QD/quadro para o interruptor do ambiente e depois seguir para a(s) luminária(s); não ligue cada luminária individualmente direto ao QD quando houver interruptor
- tomadas TUG devem ser ligadas em série dentro do mesmo circuito/ambiente, uma tomada após a outra até chegar ao QD, evitando rotas individuais de cada tomada direto ao QD
- ar-condicionado, chuveiro, motor e TUE devem ir direto ao QD em circuito dedicado
- circuitos de iluminação com cabo mínimo 1.5mm²
- circuitos de tomadas/TUE/força com cabo mínimo 2.5mm²
- nao crie nem dimensione circuitos novos
- informe caminhos por coordenadas percentuais x_pct/y_pct quando possível
- não crie cômodos novos; trabalhe apenas sobre pontos, cômodos ou planta existentes`,
        file_urls: imageUrl ? [imageUrl] : undefined,
        response_json_schema: {
          type: "object",
          properties: {
            infrastructure: { type: "array", items: { type: "object", properties: {
              type: { type: "string" }, label: { type: "string" }, room: { type: "string" },
              x_pct: { type: "number" }, y_pct: { type: "number" }, description: { type: "string" }
            }}},
            routes: { type: "array", items: { type: "object", properties: {
              label: { type: "string" }, circuit_name: { type: "string" }, system_type: { type: "string" }, conduit_diameter: { type: "string" }, description: { type: "string" },
              path: { type: "array", items: { type: "object", properties: {
                x_pct: { type: "number" }, y_pct: { type: "number" }
              }}}
            }}},
            notes: { type: "string" }
          }
        }
      }));
      if (safeArray(gen?.infrastructure).length > 0 || safeArray(gen?.routes).length > 0) {
        applyPlan({ infrastructure: gen?.infrastructure || [], routes: gen?.routes || [], notes: gen?.notes }, { applyCircuits: false, mergeResult: true });
      } else {
        const localPlan = pointCount === 0
          ? buildRoomBasedPlan({ includeSuggestedPoints: true, infraType })
          : buildLocalPlan({ includeSuggestedPoints: false, infraType });
        if (!localPlan) return;
        setNotice("A IA remota nao retornou infraestrutura. Usei os pontos/comodos existentes para criar quadro, caixas e rotas.");
        applyPlan({
          suggested_points: localPlan.suggested_points,
          infrastructure: localPlan.infrastructure,
          routes: localPlan.routes,
          recommendations: localPlan.recommendations,
          notes: localPlan.notes,
          fallback: true,
        }, { applyCircuits: false, mergeResult: true });
      }
    } catch (e) {
      const localPlan = pointCount === 0
        ? buildRoomBasedPlan({ includeSuggestedPoints: true, infraType })
        : buildLocalPlan({ includeSuggestedPoints: false, infraType });
      if (!localPlan) return;
      setNotice(`Infraestrutura gerada a partir dos pontos/comodos existentes porque a IA remota falhou (${e.message || "sem resposta"}).`);
      applyPlan({
        suggested_points: localPlan.suggested_points,
        infrastructure: localPlan.infrastructure,
        routes: localPlan.routes,
        recommendations: localPlan.recommendations,
        notes: localPlan.notes,
        fallback: true,
      }, { applyCircuits: false, mergeResult: true });
    } finally {
      setLoading(false); setStep("");
    }
  };

  const runCompleteScanner = async () => {
    setError(null);
    setNotice(null);
    setResult(null);

    if (!imageUrl && pointCount === 0 && getMountedRooms().length === 0) {
      setError("Importe uma planta baixa ou monte os cômodos antes de escanear.");
      return;
    }

    setLoading(true);
    try {
      let analysis = null;

      if (imageUrl) {
        setStep("Escaneando a planta e contando itens...");
        analysis = /** @type {any} */ (await backend.integrations.Core.InvokeLLM({
          prompt: `Você é um engenheiro eletricista orçamentista para construtoras.
Analise a planta baixa enviada e conte cada item elétrico visível ou tecnicamente necessário.

Retorne JSON com:
- rooms: ambientes identificados
- suggested_points: pontos elétricos sugeridos/identificados, com type, label, quantity, load_w, room, x_pct, y_pct
- infrastructure: quadros, caixas de passagem, eletrodutos e infraestrutura
- routes: rotas principais de eletroduto por coordenadas percentuais, com system_type eletrica/telecom e conduit_diameter em polegadas
- detected_counts: objeto com ambientes, pontos, iluminacao, tomadas, forca, interruptores, quadros, caixas, rotas, eletroduto_m
- budget_items: itens de orçamento para construtora, com name, qty, unit, unit_price, category, note
- notes: observações e premissas do orçamento

Regras:
- Conte cada item da planta; quando a planta não tiver item elétrico desenhado, estime pelo padrão NBR 5410 com base nos ambientes.
- O tipo de infraestrutura escolhido é ${infraType === "galvanizado" ? "galvanizado aparente" : "embutido"}.
- Não crie cômodos inexistentes; se o ambiente estiver incerto, marque como "ambiente a confirmar".
- O orçamento deve ser preliminar para construtora, com materiais elétricos, cabos, eletrodutos, caixas, tomadas, interruptores e quadro.
- Use preços médios realistas em BRL, mas indique em notes que são estimativas.`,
          file_urls: [imageUrl],
          response_json_schema: {
            type: "object",
            properties: {
              rooms: { type: "array", items: { type: "object" } },
              suggested_points: { type: "array", items: { type: "object" } },
              infrastructure: { type: "array", items: { type: "object" } },
              routes: { type: "array", items: { type: "object" } },
              detected_counts: { type: "object" },
              budget_items: { type: "array", items: { type: "object" } },
              notes: { type: "string" },
            },
          },
        }));
      }

      if (!analysis || !hasUsefulScannerData(analysis)) {
        setStep("Gerando contagem pelo modelo local...");
        analysis = pointCount > 0
          ? buildLocalPlan({ includeSuggestedPoints: false, infraType })
          : buildRoomBasedPlan({ includeSuggestedPoints: true, infraType });
      }

      if (!analysis) return;

      const report = buildScannerReport(analysis);
      applyPlan(analysis, { applyPoints: true, applyInfrastructure: true, applyInfrastructurePoints: true, mergeResult: false });
      onFullScanCompleted?.({ analysis, report });
      setResult({ ...analysis, scanner_report: report });
      setNotice(`Scanner completo aplicado: ${report.counts.pontos || 0} ponto(s), ${report.counts.rotas || 0} rota(s) e orçamento estimado de R$ ${report.budget_total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
    } catch (error) {
      const localPlan = pointCount > 0
        ? buildLocalPlan({ includeSuggestedPoints: false, infraType })
        : buildRoomBasedPlan({ includeSuggestedPoints: true, infraType });
      if (!localPlan) {
        setError(`Nao foi possivel escanear a planta (${error.message || "erro de IA"}).`);
        return;
      }
      const report = buildScannerReport({ ...localPlan, notes: `Fallback local aplicado porque a IA remota falhou: ${error.message || "sem resposta"}` });
      applyPlan(localPlan, { mergeResult: false });
      onFullScanCompleted?.({ analysis: localPlan, report });
      setResult({ ...localPlan, scanner_report: report, fallback: true });
      setNotice(`Scanner local aplicado. Orçamento estimado: R$ ${report.budget_total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-primary">IA Elétrica</span>
      </div>

      <div className="rounded-lg border border-[#C9E0EF] bg-white p-2.5">
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#00d8b8]">
          Pedido para IA
        </label>
        <textarea
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
          rows={4}
          placeholder="Ex.: 3 quartos, 2 banheiros, sala, cozinha, area de servico, 22 tomadas, 9 luminarias, 2 chuveiros"
          className="min-h-[92px] w-full resize-none rounded-md border border-[#CDEFE8] bg-[#F8FBFD] px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-primary focus:bg-white"
        />
        <button
          type="button"
          onClick={generateRequestedPlan}
          disabled={loading}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#00d8b8] px-3 text-sm font-semibold text-white transition hover:bg-[#00a98e] disabled:pointer-events-none disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Gerar Pedido no Quadro
        </button>
      </div>

      <div className="rounded-lg border border-[#C9E0EF] bg-white p-2.5 space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.16em] block text-[#00d8b8]">
          Método de Instalação (Infraestrutura)
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInfraType("embutido")}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold border text-center transition ${
              infraType === "embutido"
                ? "bg-[#00d8b8] text-white border-[#00d8b8]"
                : "bg-white text-[#526173] border-[#C9E0EF] hover:bg-slate-50"
            }`}
          >
            Embutido
          </button>
          <button
            type="button"
            onClick={() => setInfraType("galvanizado")}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold border text-center transition ${
              infraType === "galvanizado"
                ? "bg-[#00d8b8] text-white border-[#00d8b8]"
                : "bg-white text-[#526173] border-[#C9E0EF] hover:bg-slate-50"
            }`}
          >
            Galvanizado
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={runCompleteScanner}
        disabled={loading || (!imageUrl && pointCount === 0 && getMountedRooms().length === 0)}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0F172A] px-3 py-2 text-sm font-black text-white transition hover:bg-[#1E293B] disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
        Escanear tudo e gerar orçamento
      </button>

      <button
        type="button"
        onClick={analyzeWithAI}
        disabled={loading || !imageUrl}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Analisar Planta com IA
      </button>

      <button
        type="button"
        onClick={pullProjectCircuits}
        disabled={loading || !selectedProjectId}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {selectedProjectId ? `Puxar Circuitos do Editor (${projectCircuitCount})` : "Selecione um projeto"}
      </button>

      <button
        type="button"
        onClick={generateInfrastructure}
        disabled={loading || projectCircuitCount === 0 || !hasPositionedBoard}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cable className="w-4 h-4" />}
        Direcionar Estrutura ao QD
      </button>

      {(projectCircuitCount === 0 || !hasPositionedBoard) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">
          {projectCircuitCount === 0
            ? "Regra: circuitos precisam ser criados no Editor de Circuitos antes da planta."
            : "Regra: posicione o quadro elétrico (QD) na planta antes da IA traçar a infraestrutura."}
        </div>
      )}

      {loading && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />{step}
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-2 flex items-start gap-2">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {notice && (
        <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-2 flex items-start gap-2">
          <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />{notice}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {result.fallback && (
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2">
              <p className="font-semibold text-slate-800">Biblioteca profissional local aplicada</p>
              <p className="mt-0.5 text-muted-foreground">Pontos e infraestrutura seguem os cômodos/pontos existentes no quadro.</p>
            </div>
          )}

          {result.rooms?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ambientes</p>
              {result.rooms.map((r, i) => (
                <div key={i} className="text-xs bg-card border border-border/50 rounded-lg px-2 py-1.5 flex justify-between">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">{r.area_m2 ? `${r.area_m2}m²` : r.type}</span>
                </div>
              ))}
            </div>
          )}

          {result.suggested_points?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Pontos sugeridos ({result.suggested_points.length})
              </p>
              {result.suggested_points.slice(0, 8).map((p, i) => (
                <div key={i} className="text-xs bg-card border border-border/50 rounded-lg px-2 py-1.5 flex justify-between gap-2">
                  <span className="font-medium truncate">{p.label || p.type}</span>
                  <span className="text-muted-foreground shrink-0">{p.quantity || 1}x</span>
                </div>
              ))}
            </div>
          )}

          {result.circuits?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Circuitos do Editor ({result.circuits.length})
              </p>
              {result.circuits.map((c, i) => (
                <div key={i} className="text-xs bg-primary/5 border border-primary/20 rounded-lg px-2 py-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                    <span className="font-semibold text-primary truncate">{c.name}</span>
                  </div>
                  <div className="text-muted-foreground flex gap-2 flex-wrap">
                    <span>{c.load_w_total || c.power_w}W</span>
                    <span>·</span>
                    <span>{c.supply_type}</span>
                    <span>·</span>
                    <span>Fase {c.phase || "A"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.infrastructure?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Infraestrutura ({result.infrastructure.length})
              </p>
              {result.infrastructure.map((item, i) => (
                <div key={i} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Cable className="w-3 h-3 text-primary shrink-0" />
                    <span className="font-semibold text-primary truncate">{item.label || item.type}</span>
                  </div>
                  <p className="text-muted-foreground truncate">{item.description || item.room || "Ponto de infraestrutura"}</p>
                </div>
              ))}
            </div>
          )}

          {result.routes?.length > 0 && (
            <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-2">
              {result.routes.length} rota(s) de infraestrutura aplicada(s) na planta.
            </div>
          )}

          {result.scanner_report && (
            <div className="space-y-2 rounded-lg border border-[#C9E0EF] bg-white p-2">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-[#00d8b8]" />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00d8b8]">Orçamento construtora</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-[#526173]">
                <span className="rounded bg-[#F8FBFD] px-2 py-1">Pontos: {result.scanner_report.counts?.pontos || 0}</span>
                <span className="rounded bg-[#F8FBFD] px-2 py-1">Rotas: {result.scanner_report.counts?.rotas || 0}</span>
                <span className="rounded bg-[#F8FBFD] px-2 py-1">Tomadas: {result.scanner_report.counts?.tomadas || 0}</span>
                <span className="rounded bg-[#F8FBFD] px-2 py-1">Força: {result.scanner_report.counts?.forca || 0}</span>
              </div>
              <p className="rounded bg-[#E8F4FB] px-2 py-1.5 text-xs font-black text-[#00d8b8]">
                R$ {Number(result.scanner_report.budget_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {result.recommendations?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Checklist do engenheiro
              </p>
              {result.recommendations.map((item, i) => (
                <div key={i} className="text-xs bg-card border border-border/50 rounded-lg px-2 py-1.5 flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          )}

          {result.notes && (
            <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2">
              <span className="font-semibold text-amber-700">Obs NBR 5410:</span> {result.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
