/**
 * Testes Automatizados de Auditoria: Notificações, Configurações e Avisos e Erros
 * Valida isolamento entre usuários, IDOR, proteção de campos sensíveis, persistência de preferências e alteração segura de senha.
 */

import { backend } from "../src/api/backendClient.js";
import { getAllIssues, saveIssue } from "../src/lib/issuePersistence.js";

async function runAudit() {
  console.log("=================================================");
  console.log("🔔 INICIANDO AUDITORIA: NOTIFICAÇÕES, CONFIGURAÇÕES E AVISOS E ERROS");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`❌ FALHA: ${message}`);
      throw new Error(`Falha no teste: ${message}`);
    }
    passed++;
  }

  // Configuração de ambiente de teste em memória
  const mockStorage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
      setItem: (key, val) => mockStorage.set(key, String(val)),
      removeItem: (key) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    },
    location: { origin: "http://localhost:5173" },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  // --------------------------------------------------------------------------
  // [1/6] Criação de Contas de Teste (Usuário Comum A, Usuário Comum B, Admin)
  // --------------------------------------------------------------------------
  console.log("[1/6] Configurando contas de teste para validação de isolamento...");
  const timestamp = Date.now();
  const userA = await backend.auth.register({
    email: `user_a_${timestamp}@nacifelectric.com.br`,
    password: "PasswordA123!",
    profession: "engenheiro",
  });
  const userB = await backend.auth.register({
    email: `user_b_${timestamp}@nacifelectric.com.br`,
    password: "PasswordB123!",
    profession: "arquiteto",
  });

  // Autentica Super Admin pré-cadastrado no sistema
  const adminUser = await backend.auth.loginViaEmailPassword("grc22.09@hotmail.com", "admin");

  assert(userA.user && userA.user.id, "Usuário A cadastrado com ID único");
  assert(userB.user && userB.user.id, "Usuário B cadastrado com ID único");
  assert(adminUser.user && adminUser.user.role === "super_admin", "Admin cadastrado com privilégios de Super Admin");
  console.log("✅ Contas de teste preparadas com sucesso!\n");

  // --------------------------------------------------------------------------
  // [2/6] Auditoria de Notificações & Isolamento Estrito
  // --------------------------------------------------------------------------
  console.log("[2/6] Testando Notificações, Indicadores e Isolamento...");

  // Autentica como Usuário A e cria notificação pessoal
  backend.auth.setToken(userA.access_token);
  const notifA = await backend.entities.Notification.create({
    title: "Projeto A Atualizado",
    description: "Cálculo de queda de tensão concluído.",
    category: "Projeto",
  });

  // Autentica como Usuário B e cria notificação pessoal
  backend.auth.setToken(userB.access_token);
  const notifB = await backend.entities.Notification.create({
    title: "Projeto B Aprovado",
    description: "Orçamento homologado pelo cliente.",
    category: "Orçamento",
  });

  // Cria notificação administrativa exclusiva (audience: 'admin')
  backend.auth.setToken(adminUser.access_token);
  const notifAdmin = await backend.entities.Notification.create({
    title: "Alerta de Sistema",
    description: "Novo usuário registrado no sistema.",
    category: "Admin",
    audience: "admin",
  });

  // Validação do Usuário A: deve enxergar APENAS notifA (não notifB, não notifAdmin)
  backend.auth.setToken(userA.access_token);
  const userAList = await backend.entities.Notification.list(10);
  assert(userAList.some((n) => n.id === notifA.id), "Usuário A consulta sua própria notificação");
  assert(!userAList.some((n) => n.id === notifB.id), "Usuário A NÃO tem acesso à notificação do Usuário B (Isolamento OK)");
  assert(!userAList.some((n) => n.id === notifAdmin.id), "Usuário A NÃO tem acesso a notificações restritas para Admin");

  // Teste de tentativa de modificação IDOR em notificação de outro usuário
  let idorNotifBlocked = false;
  try {
    await backend.entities.Notification.markRead(notifB.id);
  } catch (err) {
    if (err.status === 403) idorNotifBlocked = true;
  }
  assert(idorNotifBlocked, "Usuário A impedido com HTTP 403 de marcar como lida notificação do Usuário B");

  // Teste de Mark All Read não destrutivo: Usuário A marca todas como lidas
  await backend.entities.Notification.markAllRead();
  const userANotifsAfterRead = await backend.entities.Notification.list(10);
  assert(userANotifsAfterRead.every((n) => n.read === true), "Todas as notificações do Usuário A marcadas como lidas");

  // Verifica se notificação do Usuário B permaneceu inalterada
  backend.auth.setToken(userB.access_token);
  const userBNotifs = await backend.entities.Notification.list(10);
  const foundB = userBNotifs.find((n) => n.id === notifB.id);
  assert(foundB && foundB.read === false, "Notificações do Usuário B permaneceram não lidas (sem efeito colateral)");

  // Teste de ClearAll não destrutivo: Usuário A limpa suas notificações
  backend.auth.setToken(userA.access_token);
  await backend.entities.Notification.clearAll();
  const userAListEmpty = await backend.entities.Notification.list(10);
  assert(userAListEmpty.length === 0, "Usuário A limpou com sucesso suas notificações");

  // Usuário B ainda deve ter sua notificação intacta
  backend.auth.setToken(userB.access_token);
  const userBListAfterClear = await backend.entities.Notification.list(10);
  assert(userBListAfterClear.some((n) => n.id === notifB.id), "Limpeza do Usuário A NÃO apagou notificações do Usuário B");
  console.log("✅ Isolamento, estados de leitura e limpeza de notificações validados!\n");

  // --------------------------------------------------------------------------
  // [3/6] Auditoria de Configurações do Usuário & Preferências
  // --------------------------------------------------------------------------
  console.log("[3/6] Testando Configurações do Usuário e Persistência de Preferências...");
  backend.auth.setToken(userA.access_token);

  // Atualização cadastral legítima
  const updatedProfile = await backend.auth.updateMe({
    full_name: "Gabriel Rezende Atualizado",
    company: "Rezende Engenharia Elétrica LTDA",
    crea: "CREA-MG 123456/D",
    phone: "(31) 98765-4321",
  });

  assert(updatedProfile.full_name === "Gabriel Rezende Atualizado", "Nome completo atualizado corretamente");
  assert(updatedProfile.company === "Rezende Engenharia Elétrica LTDA", "Empresa atualizada e persistida");
  assert(updatedProfile.crea === "CREA-MG 123456/D", "CREA persistido");

  // Atualização e persistência de Preferências do Sistema
  const customPreferences = {
    notify_projects: false,
    notify_issues: true,
    notify_compliance: true,
    unit_system: "imperial",
    date_format: "DD/MM/YYYY",
  };

  const withPreferences = await backend.auth.updateMe({
    preferences: customPreferences,
  });

  assert(withPreferences.preferences.unit_system === "imperial", "Preferência de unidade de medida persistida");
  assert(withPreferences.preferences.notify_projects === false, "Preferência de notificação de projetos desativada e salva");
  console.log("✅ Configurações e preferências persistidas e recuperadas com sucesso!\n");

  // --------------------------------------------------------------------------
  // [4/6] Auditoria da Alteração de Senha Segura
  // --------------------------------------------------------------------------
  console.log("[4/6] Testando Alteração de Senha Segura e Invalidação de Credencial Antiga...");
  backend.auth.setToken(userA.access_token);

  // Tentativa de troca com senha atual incorreta
  let wrongPassBlocked = false;
  try {
    await backend.auth.updateMe({
      current_password: "SenhaIncorretaErrada!",
      new_password: "NovaSenhaValida123!",
    });
  } catch (err) {
    if (err.status === 403) wrongPassBlocked = true;
  }
  assert(wrongPassBlocked, "Alteração de senha com senha atual incorreta rejeitada com HTTP 403");

  // Tentativa de troca com senha muito curta (< 6 caracteres)
  let shortPassBlocked = false;
  try {
    await backend.auth.updateMe({
      current_password: "PasswordA123!",
      new_password: "123",
    });
  } catch (err) {
    if (err.status === 400) shortPassBlocked = true;
  }
  assert(shortPassBlocked, "Nova senha com menos de 6 caracteres rejeitada com HTTP 400");

  // Alteração válida de senha
  await backend.auth.updateMe({
    current_password: "PasswordA123!",
    new_password: "NovaSenhaA123!@#",
  });

  // Tenta logar com a senha antiga (deve falhar)
  let oldLoginFailed = false;
  try {
    await backend.auth.loginViaEmailPassword(userA.user.email, "PasswordA123!");
  } catch (err) {
    if (err.status === 401) oldLoginFailed = true;
  }
  assert(oldLoginFailed, "Senha antiga não é mais aceita no login após alteração");

  // Login com a nova senha (deve suceder)
  const newLogin = await backend.auth.loginViaEmailPassword(userA.user.email, "NovaSenhaA123!@#");
  assert(newLogin.access_token, "Login com a nova senha realizado com sucesso");
  console.log("✅ Fluxo de alteração segura de senha e invalidação da senha anterior comprovado!\n");

  // --------------------------------------------------------------------------
  // [5/6] Auditoria da Página Avisos e Erros: Envio, Protocolo e Armazenamento
  // --------------------------------------------------------------------------
  console.log("[5/6] Testando Envio de Relatos na Página Avisos e Erros...");
  backend.auth.setToken(userA.access_token);

  // Envio de relato pelo Usuário A
  const issueA = await backend.entities.Issue.create({
    type: "erro",
    title: "Erro no cálculo de condutor subterrâneo",
    module: "Calculadora",
    description: "Ao dimensionar circuito trifásico em duto enterrado, a queda de tensão calculada divergiu da NBR 5410 Tabela 36.",
    steps_to_reproduce: "1. Acessar calculadora. 2. Escolher método B1 subterrâneo. 3. Calcular.",
    expected_result: "Queda de 2.1%",
    actual_result: "Queda de 4.8%",
    attachments: [{ id: "att_1", name: "evidencia.png", type: "image/png" }],
    technical_info: { browser: "Chrome 122", os: "Windows 11" },
  });

  assert(issueA.protocol && issueA.protocol.startsWith("#ERR-"), "Relato recebe protocolo no padrão #ERR-YYYY-XXXX");
  assert(issueA.status === "recebido", "Status inicial definido como 'recebido'");
  assert(issueA.user_id === userA.user.id, "Relato associado ao ID do Usuário A autenticado");
  assert(issueA.timeline && issueA.timeline.length >= 1, "Linha do tempo inicializada com evento de abertura");

  // Envio de relato pelo Usuário B
  backend.auth.setToken(userB.access_token);
  const issueB = await backend.entities.Issue.create({
    type: "aviso",
    title: "Sugestão de novo disjuntor WEG na biblioteca",
    module: "Biblioteca NBR",
    description: "Seria excelente adicionar a linha de disjuntores caixa moldada DWB.",
  });
  assert(issueB.id !== issueA.id, "Identificadores exclusivos gerados para cada relato");
  assert(issueB.protocol !== issueA.protocol, "Protocolos sequenciais exclusivos para cada relato");
  console.log("✅ Criação, geração de protocolo e persistência de relatos comprovados!\n");

  // --------------------------------------------------------------------------
  // [6/6] Auditoria de Segurança: IDOR em Relatos, Moderação e Notas Internas
  // --------------------------------------------------------------------------
  console.log("[6/6] Testando Proteção contra IDOR, Moderação e Sigilo de Notas Internas...");

  // Usuário B tenta ler relato do Usuário A via backend.entities.Issue.get (IDOR)
  backend.auth.setToken(userB.access_token);
  let idorIssueReadBlocked = false;
  try {
    await backend.entities.Issue.get(issueA.id);
  } catch (err) {
    if (err.status === 403) idorIssueReadBlocked = true;
  }
  assert(idorIssueReadBlocked, "Usuário B impedido com HTTP 403 de consultar relato pertencente ao Usuário A");

  // Usuário B tenta excluir relato do Usuário A (IDOR)
  let idorIssueDeleteBlocked = false;
  try {
    await backend.entities.Issue.delete(issueA.id);
  } catch (err) {
    if (err.status === 403) idorIssueDeleteBlocked = true;
  }
  assert(idorIssueDeleteBlocked, "Usuário B impedido com HTTP 403 de excluir relato do Usuário A");

  // Usuário B tenta alterar status do relato (Elevação indevida de privilégios)
  let unauthorizedStatusChangeBlocked = false;
  try {
    await backend.entities.Issue.updateStatusAndPriority(issueA.id, {
      status: "resolvido",
      priority: "critica",
    });
  } catch (err) {
    if (err.status === 403) unauthorizedStatusChangeBlocked = true;
  }
  assert(unauthorizedStatusChangeBlocked, "Usuário não-admin impedido de modificar status e prioridade de relatos");

  // Administrador atualiza o relato com resposta oficial e notas internas confidenciais
  backend.auth.setToken(adminUser.access_token);
  const updatedByAdmin = await backend.entities.Issue.updateStatusAndPriority(issueA.id, {
    status: "em_correcao",
    priority: "alta",
    admin_response: "Identificamos a divergência no fator de agrupamento e estamos aplicando o patch corretivo.",
    internal_notes: "CHAVE_INTERNA_LOG: Falha de arredondamento em Math.round no arquivo conductorSizing.js:145",
  });

  assert(updatedByAdmin.status === "em_correcao", "Administrador atualizou o status para 'em_correcao'");
  assert(updatedByAdmin.priority === "alta", "Administrador atualizou a prioridade para 'alta'");

  // Administrador adiciona comentário com nota interna restrita
  await backend.entities.Issue.addComment(issueA.id, {
    message: "Ticket JIRA ELEC-842 criado para correção na sprint 4.",
    is_internal: true,
  });

  // Usuário A (autor do relato) consulta o relato:
  // DEVE ver o status atualizado e a resposta oficial, MAS NÃO DEVE VER as notas internas nem o comentário confidencial
  backend.auth.setToken(userA.access_token);
  const userAView = await backend.entities.Issue.get(issueA.id);

  assert(userAView.status === "em_correcao", "Usuário A visualiza o novo status do atendimento");
  assert(userAView.internal_notes === undefined, "Notas internas confidenciais foram SANITIZADAS e NÃO vazaram para o usuário comum");
  assert(
    !userAView.comments || !userAView.comments.some((c) => c.is_internal === true),
    "Comentários marcados como 'is_internal' NÃO foram expostos ao usuário comum"
  );

  // Usuário A adiciona comentário legítimo ao seu relato
  const userComment = await backend.entities.Issue.addComment(issueA.id, {
    message: "Obrigado equipe, anexo o memorial de cálculo complementar se precisarem.",
  });
  assert(userComment.comments.some((c) => c.author_id === userA.user.id), "Comentário do autor do relato registrado com sucesso");

  // Estatísticas de relatos: usuário comum só vê suas estatísticas; admin vê todas
  backend.auth.setToken(userA.access_token);
  const userAStats = await backend.entities.Issue.getStats();
  assert(userAStats.total === 1, "Estatísticas do Usuário A escopadas apenas para seus próprios relatos");

  backend.auth.setToken(adminUser.access_token);
  const adminStats = await backend.entities.Issue.getStats();
  assert(adminStats.total >= 2, "Estatísticas do Administrador abrangem a totalidade dos relatos do sistema");

  console.log("✅ Proteção IDOR, isolamento de dados, sanitização de notas internas e moderação administrativa 100% comprovados!\n");

  console.log("=================================================");
  console.log(`🎉 TODOS OS ${passed}/${total} TESTES DE AUDITORIA FORAM APROVADOS COM SUCESSO!`);
  console.log("=================================================");
}

runAudit().catch((err) => {
  console.error("FATAL: Auditoria falhou!", err);
  process.exit(1);
});
