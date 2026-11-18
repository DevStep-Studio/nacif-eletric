# Acesso e limites de assinatura

O catálogo compartilhado em `backend/src/lib/planCatalog.js` define os valores exibidos na comparação e aplicados pela API e pela interface.

| Plano | Projetos | Armazenamento | Membros (inclui titular) | Exportações/mês | IA/mês |
|---|---:|---:|---:|---:|---:|
| Estudante | 5 | 1 GB | 1 | 20 | 20 |
| Elétrico | 30 | 5 GB | 3 | 100 | 100 |
| Solar | 30 | 5 GB | 3 | 100 | 100 |
| Completo | Ilimitados | 50 GB | 15 | Ilimitadas | 500 |

- Estudante acessa os módulos elétricos e solares em versão acadêmica, com marca nos documentos; exige comprovação aprovada e válida. Não inclui equipes.
- Elétrico inclui planta, quadro e unifilar; não inclui projeto e layout solar.
- Solar inclui projeto e layout solar; os módulos gerais de planta, quadro e unifilar ficam bloqueados. As proteções e circuitos próprios do projeto solar permanecem disponíveis.
- Completo inclui todos os módulos.
- Sem período pago confirmado ou teste vigente do Asaas, a conta fica **Sem plano**, sem acesso aos módulos. A interface permite somente contratação e configurações da conta. Projetos e dados anteriores são preservados; leitura pela API para gestão da conta permanece disponível.

O campo `plan` isolado não libera assinatura. Períodos futuros e expirados não liberam acesso; cancelamento mantém direitos durante o período já pago. Administradores têm acesso operacional separado da assinatura comercial.

Criação e duplicação de projetos, gravação de conteúdo, arquivos, IA, exportações e convites são validados no servidor. Operações que consomem cotas usam bloqueio da conta em transações para impedir ultrapassagem por requisições simultâneas. Armazenamento inclui arquivos enviados, conteúdo dos projetos e histórico de revisões. Cotas mensais usam o mês UTC. Projetos existentes continuam disponíveis para consulta após mudança ou expiração do plano, sem exclusão automática.

Falhas de autorização ou indisponibilidade da API bloqueiam exportações. Exportações acadêmicas/gratuitas recebem identificação em PDF, SVG, CSV e impressão.

## Validação

- `node backend/node_modules/tsx/dist/cli.mjs --test backend/test/plan-access.ts`
- `node scripts/api-client-integration.mjs`
- `node scripts/subscription-state-smoke.mjs`
- `DATABASE_URL=mysql://.../banco_descartavel_test npm --prefix backend run test:integration`

A suíte MySQL exige banco com sufixo `_test` e verifica também concorrência, mudança de plano, módulos, armazenamento e cotas reais sem cobrança ou chamada ao provedor de IA.

Publicar frontend e backend juntos. O teste grátis exige a migration `20261117000000_complete_trial`.

## Isolamento dos projetos por conta

As rotas de projetos (lista, detalhes, revisões, alteração, duplicação e exclusão) e a autorização de exportação exigem que o usuário autenticado seja o criador. Os papéis admin e super_admin não ampliam o escopo da área Meus Projetos.

Em produção, o frontend usa exclusivamente os projetos retornados pela API. Registros antigos no localStorage não são mesclados nem usados como fallback de leitura ou escrita. Eles não são apagados automaticamente. No modo local de testes, projetos sem proprietário ou de outro usuário também são inacessíveis. O cache de consultas é limpo ao sair ou trocar de conta.

### Publicação da correção de isolamento

Publicar o frontend e reiniciar o backend é obrigatório: alterar somente os arquivos não atualiza um processo Node já iniciado. Na pasta do projeto no servidor, executar `npm run build` (o postbuild prepara e recarrega a API); confirmar nos logs que o backend iniciou corretamente. Em instalações PM2, pode-se verificar com `pm2 status nacif-electric-api`.

A resposta autenticada de `/api/projects` deve conter `X-Project-Isolation: owner-v2` e `Cache-Control: private, no-store`. Sem esse marcador, a requisição está chegando a uma versão antiga ou a outro backend/proxy. O frontend valida `owner_id` com o ID retornado por `/api/auth/me`, ignora registros sem proprietário e impede que uma resposta iniciada na sessão anterior seja exibida.


## Teste grátis do Completo

- Oferecido uma única vez por conta, apenas no Completo mensal (R$ 210,00/mês). Usuários com histórico de pagamento não recebem novo teste.
- O cliente informa cartão e dados do titular e aceita expressamente a cobrança recorrente. O servidor cria a assinatura com cartão diretamente no Asaas, que o valida sem cobrança imediata. O cartão e o CVV nunca são gravados no banco nem retornados pela API; o logger remove o campo de cartão.
- O Asaas agenda por data, sem horário: o primeiro vencimento é arredondado para a próxima meia-noite de São Paulo depois de sete dias completos. Isso concede entre sete e oito dias de teste e evita cobrar antes de sete dias. A data efetiva e o preço são mostrados antes do aceite.
- O acesso só começa após confirmação da criação pelo Asaas. `trialRequested`, `trialStartedAt` e `trialEndsAt` guardam o histórico no banco; `trialUsed` permanece no perfil após cancelamento. Respostas perdidas são conciliadas pela referência externa existente, sem repetir a criação.
- A API expõe `has_active_trial`, `trial_eligible`, `trial_start_date`, `trial_end_date` e `first_charge_date`. `has_paid_subscription` permanece falso durante o teste; o status é `trialing`.
- Cancelar desativa a assinatura e exclui as cobranças pendentes, mantendo acesso até o fim do teste. Expiração bloqueia os módulos mesmo sem webhook. Somente pagamento confirmado libera o período pago seguinte.
- Durante o teste, a interface não oferece pagamento antecipado da fatura nem mudança de plano. Contratações anuais, Pix e boleto mantêm o fluxo pago sem teste.

### Publicação e homologação

1. Aplicar as migrations antes de reiniciar a API: `cd backend && npx prisma migrate deploy && npx prisma generate`.
2. Publicar frontend e backend juntos; executar a checagem de schema e reiniciar o processo da API.
3. A captura de cartão exige HTTPS, com proxy encaminhando o IP real do cliente. Configurar chave e webhook do Asaas para o ambiente correto.
4. No sandbox real, conferir cartão válido/recusado, ausência de cobrança inicial, vencimento futuro e cancelamento que remove a cobrança pendente. Confirmar a conversão com webhooks e a expiração com cartão recusado.

Validação automatizada: `npm --prefix backend run typecheck`, `node backend/node_modules/tsx/dist/cli.mjs --test backend/test/asaas-billing.ts backend/test/auth-register.ts backend/test/plan-access.ts` e `node scripts/subscription-state-smoke.mjs`.
Os testes de cobrança usam um simulador isolado; não substituem a homologação com credenciais reais de sandbox.


## Exclusão definitiva de conta

`DELETE /api/auth/me` e a exclusão administrativa removem fisicamente o usuário, liberando o e-mail para novo cadastro. A operação usa uma transação e bloqueio do usuário; remove explicitamente registros locais de cobrança e auditoria ligados à conta. As relações do banco removem projetos, revisões, orçamentos, relatos, comentários, notificações e tokens de recuperação em cascata.

Uma assinatura renovável (inclusive teste grátis) ou operação de cobrança em andamento bloqueia a exclusão com HTTP 409. O cliente deve cancelar em Assinatura e repetir a exclusão após a confirmação. Falhas da API permanecem visíveis no diálogo e não exibem sucesso nem encerram a sessão. A confirmação existente por digitação de EXCLUIR permanece obrigatória.

Arquivos antigos de upload não têm vínculo de proprietário no banco; a exclusão remove as referências dos projetos, mas não apaga arquivos arbitrários por URL, pois poderiam pertencer a outra conta. A remoção física desses arquivos exige rastreamento de propriedade separado.

Validação: `node backend/node_modules/tsx/dist/cli.mjs --test backend/test/account-deletion.ts` e `node scripts/subscription-state-smoke.mjs`. Nenhuma migration nova é necessária; o banco deve ter as chaves estrangeiras com cascata previstas no schema Prisma.
