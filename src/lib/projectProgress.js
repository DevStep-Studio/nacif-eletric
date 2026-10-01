import { calcProjectMetrics } from "@/lib/electricalEngine";

export const PROJECT_WORKFLOW_STEPS = [
  {
    id: "info",
    label: "Informações",
    shortLabel: "Dados",
    desc: "Identificação, tipo de imóvel e padrão de entrada.",
    path: (id) => (id ? `/projects/${id}` : "/projects/new"),
  },
  {
    id: "plant",
    label: "Planta",
    shortLabel: "Planta",
    desc: "Desenho da arquitetura ou importação da planta baixa.",
    path: (id) => (id ? `/planta-ia?project=${id}` : "/planta-ia"),
  },
  {
    id: "points",
    label: "Pontos",
    shortLabel: "Pontos",
    desc: "Locação de tomadas (TUG/TUE), iluminação e interruptores.",
    path: (id) => (id ? `/planta-ia?project=${id}&tab=points` : "/planta-ia"),
  },
  {
    id: "circuits",
    label: "Circuitos",
    shortLabel: "Circuitos",
    desc: "Agrupamento de cargas, dimensionamento de cabos e disjuntores.",
    path: (id) => (id ? `/circuit-editor?project=${id}` : "/circuit-editor"),
  },
  {
    id: "panel",
    label: "Quadro elétrico",
    shortLabel: "Quadro",
    desc: "Montagem do QDG, trilhos DIN, barramentos e IDR/DPS.",
    path: (id) => (id ? `/panel-generator?project=${id}` : "/panel-generator"),
  },
  {
    id: "balance",
    label: "Balanço de fases",
    shortLabel: "Balanço",
    desc: "Equilíbrio de potência por fase e conformidade com a NBR 5410.",
    path: (id) => (id ? `/phase-balance?project=${id}` : "/phase-balance"),
  },
  {
    id: "diagram",
    label: "Diagrama unifilar",
    shortLabel: "Diagrama",
    desc: "Geração do esquema elétrico unifilar e pranchas técnicas.",
    path: (id) => (id ? `/unifilar?project=${id}` : "/unifilar"),
  },
  {
    id: "documentation",
    label: "Documentação",
    shortLabel: "Documentos",
    desc: "Memorial descritivo, lista de materiais (BOM) e orçamento.",
    path: (id) => (id ? `/memorial?project=${id}` : "/memorial"),
  },
];

export function hasPlantData(project) {
  if (!project) return false;
  return Boolean(
    project.plant_design ||
      project.plantDocument ||
      project.floor_plan ||
      project.floorPlan ||
      (Array.isArray(project.importedPlanElements) && project.importedPlanElements.length > 0) ||
      (Array.isArray(project.walls) && project.walls.length > 0) ||
      (Array.isArray(project.rooms) && project.rooms.length > 0)
  );
}

export function hasElectricalPoints(project) {
  if (!project) return false;
  const count =
    (project.electrical_points?.length || 0) +
    (project.electricalPoints?.length || 0) +
    (project.points?.length || 0) +
    (project.lighting_points?.length || 0) +
    (project.outlets?.length || 0);
  return count > 0;
}

export function hasCircuits(project) {
  if (!project) return false;
  return Array.isArray(project.circuits) && project.circuits.length > 0;
}

export function hasPanelData(project) {
  if (!project) return false;
  return Boolean(
    project.panel_layout ||
      project.panelLayout ||
      project.board_layout ||
      project.distribution_board ||
      (Array.isArray(project.panel_boards) && project.panel_boards.length > 0)
  );
}

export function hasPhaseBalanceOrValidations(project) {
  if (!hasCircuits(project)) return false;
  try {
    const metrics = calcProjectMetrics(project);
    const criticalErrors = metrics.validations?.filter((v) => v.severity === "error") || [];
    return criticalErrors.length === 0;
  } catch {
    return true;
  }
}

export function hasDiagramGenerated(project) {
  if (!hasCircuits(project)) return false;
  return Boolean(project.unifilar_generated || project.diagram_config || hasCircuits(project));
}

export function hasDocumentation(project) {
  if (!project) return false;
  return Boolean(
    project.memorial_descritivo ||
      project.technical_memorial ||
      project.budget_data ||
      Number(project.exports_count || project.exportsCount || 0) > 0 ||
      (project.status && ["concluido", "aprovado", "finalizado"].some((s) => String(project.status).toLowerCase().includes(s)))
  );
}

/**
 * Calcula o progresso real e o próximo passo recomendado para qualquer projeto
 * @param {Object} project Objeto de projeto com circuitos, plantas e dados
 * @returns {Object} Dados completos de progresso
 */
export function getProjectProgress(project) {
  if (!project || !project.id) {
    return {
      percent: 0,
      completedCount: 0,
      totalCount: PROJECT_WORKFLOW_STEPS.length,
      steps: PROJECT_WORKFLOW_STEPS.map((step) => ({ ...step, done: false })),
      nextStep: PROJECT_WORKFLOW_STEPS[0],
      isComplete: false,
      summary: "Sem dados de projeto",
    };
  }

  const projectId = project.id;
  const isInfoDone = Boolean(project.name && project.name.trim().length > 0);
  const isPlantDone = hasPlantData(project);
  const isPointsDone = hasElectricalPoints(project);
  const isCircuitsDone = hasCircuits(project);
  const isPanelDone = hasPanelData(project) || (isCircuitsDone && project.circuits.length >= 2);
  const isBalanceDone = isCircuitsDone && hasPhaseBalanceOrValidations(project);
  const isDiagramDone = isCircuitsDone && (hasDiagramGenerated(project) || isPanelDone);
  const isDocumentationDone = hasDocumentation(project);

  const stepStatus = [
    { ...PROJECT_WORKFLOW_STEPS[0], done: isInfoDone, href: PROJECT_WORKFLOW_STEPS[0].path(projectId) },
    { ...PROJECT_WORKFLOW_STEPS[1], done: isPlantDone, href: PROJECT_WORKFLOW_STEPS[1].path(projectId) },
    { ...PROJECT_WORKFLOW_STEPS[2], done: isPointsDone, href: PROJECT_WORKFLOW_STEPS[2].path(projectId) },
    { ...PROJECT_WORKFLOW_STEPS[3], done: isCircuitsDone, href: PROJECT_WORKFLOW_STEPS[3].path(projectId) },
    { ...PROJECT_WORKFLOW_STEPS[4], done: isPanelDone, href: PROJECT_WORKFLOW_STEPS[4].path(projectId) },
    { ...PROJECT_WORKFLOW_STEPS[5], done: isBalanceDone, href: PROJECT_WORKFLOW_STEPS[5].path(projectId) },
    { ...PROJECT_WORKFLOW_STEPS[6], done: isDiagramDone, href: PROJECT_WORKFLOW_STEPS[6].path(projectId) },
    { ...PROJECT_WORKFLOW_STEPS[7], done: isDocumentationDone, href: PROJECT_WORKFLOW_STEPS[7].path(projectId) },
  ];

  const completedCount = stepStatus.filter((s) => s.done).length;
  const totalCount = stepStatus.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  // Determina o próximo passo recomendado de forma lógica e sequencial
  const nextStep = stepStatus.find((s) => !s.done) || stepStatus[stepStatus.length - 1];

  let nextStepActionTitle = "Próxima etapa recomendada";
  let nextStepActionDescription = nextStep.desc;
  let nextStepButtonLabel = `Ir para ${nextStep.shortLabel}`;

  if (!isPlantDone) {
    nextStepActionTitle = "Adicione a planta do projeto";
    nextStepActionDescription = "Desenhe os cômodos ou importe um arquivo DWG / imagem para posicionar as cargas elétricas.";
    nextStepButtonLabel = "Abrir Editor de Planta";
  } else if (!isPointsDone) {
    nextStepActionTitle = "Configure os pontos elétricos";
    nextStepActionDescription = "Insira as tomadas TUG/TUE, pontos de luz e interruptores nos ambientes da planta.";
    nextStepButtonLabel = "Adicionar Pontos";
  } else if (!isCircuitsDone) {
    nextStepActionTitle = "Crie os circuitos do projeto";
    nextStepActionDescription = "Distribua as cargas em circuitos e confira o dimensionamento automático dos condutores (NBR 5410).";
    nextStepButtonLabel = "Criar Circuitos";
  } else if (!isPanelDone) {
    nextStepActionTitle = "Monte o quadro de distribuição";
    nextStepActionDescription = "Organize os disjuntores DIN, barramentos de fase e proteções diferenciais (IDR/DPS).";
    nextStepButtonLabel = "Gerar Quadro Elétrico";
  } else if (!isBalanceDone) {
    nextStepActionTitle = "Equilibre o balanço de fases";
    nextStepActionDescription = "Verifique o desequilíbrio entre fases e aplique o balanceamento automático.";
    nextStepButtonLabel = "Equilibrar Fases";
  } else if (!isDiagramDone) {
    nextStepActionTitle = "Gere o diagrama unifilar";
    nextStepActionDescription = "Visualize a prancha unifilar com simbologia padronizada conforme as normas brasileiras.";
    nextStepButtonLabel = "Ver Diagrama Unifilar";
  } else if (!isDocumentationDone) {
    nextStepActionTitle = "Emita a documentação técnica";
    nextStepActionDescription = "Exporte o memorial descritivo, lista de compras e relatórios executivos em PDF.";
    nextStepButtonLabel = "Gerar Documentação";
  } else {
    nextStepActionTitle = "Projeto concluído!";
    nextStepActionDescription = "Todas as etapas técnicas foram atendidas com sucesso.";
    nextStepButtonLabel = "Ver Detalhes do Projeto";
  }

  return {
    percent,
    completedCount,
    totalCount,
    steps: stepStatus,
    nextStep,
    nextStepActionTitle,
    nextStepActionDescription,
    nextStepButtonLabel,
    isComplete: percent === 100,
  };
}
