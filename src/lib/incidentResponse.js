/**
 * Procedimento Operacional Padrão (POP) e Matriz de Incidentes Críticos — Nacif Electric
 * 
 * Define os critérios de severidade, SLAs de atendimento, matriz RACI,
 * runbook de resposta e templates de comunicação formal com os clientes.
 */

export const INCIDENT_SEVERITY = {
  CRITICAL: {
    level: "P1",
    label: "Crítico",
    description: "Indisponibilidade generalizada, perda/corrupção de projetos, brecha de segurança ou vazamento de dados.",
    slaFirstResponseMinutes: 30,
    slaTargetMitigationHours: 2,
    autoEscalate: true,
    channels: ["push_urgent", "sms_tech_lead", "status_page_banner"],
  },
  HIGH: {
    level: "P2",
    label: "Alto",
    description: "Módulo essencial inoperante (Planta IA, Gerador de Quadro, Exportação PDF) sem alternativa imediata.",
    slaFirstResponseMinutes: 120, // 2 horas
    slaTargetMitigationHours: 8,
    autoEscalate: true,
    channels: ["email_team", "status_page_notice"],
  },
  MEDIUM: {
    level: "P3",
    label: "Médio",
    description: "Falha funcional pontual, inconsistência visual secundária ou lentidão com contorno temporário viável.",
    slaFirstResponseMinutes: 480, // 8 horas
    slaTargetMitigationHours: 24,
    autoEscalate: false,
    channels: ["issue_tracker"],
  },
  LOW: {
    level: "P4",
    label: "Baixo",
    description: "Dúvidas de uso, pequenas melhorias de layout, sugestões de novos recursos ou ajustes cosméticos.",
    slaFirstResponseMinutes: 1440, // 24 horas (1 dia útil)
    slaTargetMitigationHours: 72,
    autoEscalate: false,
    channels: ["issue_tracker"],
  },
};

export const SUPPORT_CHANNELS = {
  officialEmail: "suporte@nacifelectric.com.br",
  legalEmail: "juridico@nacifelectric.com.br",
  inAppTracker: "/avisos-erros",
  statusPage: "/status",
  helpCenter: "/help",
  businessHours: {
    days: "Segunda a Sexta-feira",
    hours: "08:00 às 18:00 (Horário de Brasília - BRT)",
    emergencyOnCall: "Monitoramento automatizado 24/7 para incidentes P1 (Críticos).",
  },
};

export const INCIDENT_RACI = {
  incidentCommander: {
    role: "Líder de Incidentes / Tech Lead",
    responsibilities: [
      "Declarar e classificar o incidente (P1/P2/P3/P4).",
      "Coordenar a equipe de diagnóstico e autorizar intervenções de emergência.",
      "Aprovar a execução de rollbacks ou restaurações de backup.",
      "Redigir o post-mortem técnico e aprovar o encerramento do incidente.",
    ],
  },
  infrastructureLead: {
    role: "Engenheiro de Infraestrutura & Banco de Dados",
    responsibilities: [
      "Verificar logs de auditoria, tráfego de rede e integridade das conexões PostgreSQL.",
      "Executar checkpoints de snapshot ou rollback de releases no servidor.",
      "Garantir a preservação dos dados dos usuários antes de qualquer medida de contenção.",
    ],
  },
  customerSuccessLead: {
    role: "Comunicação com Clientes & Suporte",
    responsibilities: [
      "Atualizar a página de status oficial (/status) dentro do prazo de SLA.",
      "Responder tickets da página Avisos e Erros informando previsão e medidas de contorno.",
      "Garantir que comunicados aos clientes sejam claros e não exponham dados sensíveis.",
    ],
  },
};

export const INCIDENT_RUNBOOK_STEPS = [
  {
    step: 1,
    title: "Detecção e Triagem",
    actions: [
      "Registrar a hora do primeiro alerta.",
      "Confirmar o escopo do impacto (todos os usuários vs. módulo isolado).",
      "Classificar a severidade (P1, P2, P3 ou P4) com base no impacto real.",
      "Atribuir o identificador de incidente (ex: INC-202610-001).",
    ],
  },
  {
    step: 2,
    title: "Contenção Imediata",
    actions: [
      "Se houver risco de corrupção de dados: ativar modo somente-leitura ou isolamento de rota.",
      "Ativar circuit-breakers de conexões degradadas.",
      "Publicar aviso na página de Status (/status) com transparência e clareza.",
    ],
  },
  {
    step: 3,
    title: "Investigação da Causa Raiz",
    actions: [
      "Analisar stacktrace e logs recentes de deploy (git log, commits recentes).",
      "Examinar integridade de transações no banco de dados.",
      "Isolar se a causa é infraestrutura, banco de dados ou código da aplicação.",
    ],
  },
  {
    step: 4,
    title: "Mitigação e Rollback",
    actions: [
      "Priorizar rollback para versão estável anterior caso a causa seja o último deploy.",
      "Caso seja problema de banco: aplicar script de correção idempotente testado.",
      "NUNCA restaurar backup sem avaliar o risco de perda de transações recém-criadas.",
    ],
  },
  {
    step: 5,
    title: "Validação da Integridade dos Dados",
    actions: [
      "Executar bateria de testes de integridade (projetos, circuitos, orçamentos).",
      "Confirmar que nenhum projeto de usuário sofreu corrupção ou perda silenciosa.",
      "Validar que autenticação e rotas principais responderam com código 200 OK.",
    ],
  },
  {
    step: 6,
    title: "Comunicação de Encerramento e Post-Mortem",
    actions: [
      "Atualizar o status do incidente para 'Resolvido' na página de Status.",
      "Responder aos clientes afetados informando a normalização.",
      "Elaborar relatório de Post-Mortem em até 48 horas úteis com medidas preventivas definitivas.",
    ],
  },
];

export const INCIDENT_NOTIFICATION_TEMPLATES = {
  investigating: (incidentTitle, affectedService) => ({
    title: `[Aviso de Investigação] ${incidentTitle}`,
    badge: "Em Investigação",
    body: `Identificamos uma instabilidade no serviço '${affectedService}'. Nossa equipe de engenharia já está atuando ativamente para restabelecer a normalidade. Seus projetos e dados permanecem íntegros e seguros. Novas atualizações serão publicadas nesta página em até 30 minutos.`,
  }),
  mitigating: (incidentTitle) => ({
    title: `[Em Correção] ${incidentTitle}`,
    badge: "Em Correção",
    body: `A causa da instabilidade foi identificada e as correções estão sendo aplicadas neste momento. O serviço está sendo gradualmente restabelecido. Agradecemos sua compreensão.`,
  }),
  resolved: (incidentTitle) => ({
    title: `[Resolvido] ${incidentTitle}`,
    badge: "Resolvido",
    body: `O incidente foi completamente solucionado e todos os serviços estão operando em conformidade com as normas técnicas. A integridade de todos os dados dos usuários foi verificada e preservada.`,
  }),
};

export function classifyIncident(impact) {
  if (impact?.databaseDown || impact?.dataBreach || impact?.globalOutage) {
    return INCIDENT_SEVERITY.CRITICAL;
  }
  if (impact?.coreModuleDown || impact?.exportBlocked) {
    return INCIDENT_SEVERITY.HIGH;
  }
  if (impact?.partialFeatureIssue || impact?.performanceLag) {
    return INCIDENT_SEVERITY.MEDIUM;
  }
  return INCIDENT_SEVERITY.LOW;
}
