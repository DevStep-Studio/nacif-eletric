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
- Sem período pago confirmado e vigente do Asaas, aplica-se o gratuito: 1 projeto, 100 MB, 3 exportações/mês, sem IA, solar, quadro, unifilar ou equipes. Permanecem os recursos básicos de planta, cálculo, biblioteca e orçamento.

O campo `plan` isolado não libera assinatura. Períodos futuros e expirados não liberam acesso; cancelamento mantém direitos durante o período já pago. Administradores têm acesso operacional separado da assinatura comercial.

Criação e duplicação de projetos, gravação de conteúdo, arquivos, IA, exportações e convites são validados no servidor. Operações que consomem cotas usam bloqueio da conta em transações para impedir ultrapassagem por requisições simultâneas. Armazenamento inclui arquivos enviados, conteúdo dos projetos e histórico de revisões. Cotas mensais usam o mês UTC. Projetos existentes continuam disponíveis para consulta após mudança ou expiração do plano, sem exclusão automática.

Falhas de autorização ou indisponibilidade da API bloqueiam exportações. Exportações acadêmicas/gratuitas recebem identificação em PDF, SVG, CSV e impressão.

## Validação

- `node backend/node_modules/tsx/dist/cli.mjs --test backend/test/plan-access.ts`
- `node scripts/api-client-integration.mjs`
- `node scripts/subscription-state-smoke.mjs`
- `DATABASE_URL=mysql://.../banco_descartavel_test npm --prefix backend run test:integration`

A suíte MySQL exige banco com sufixo `_test` e verifica também concorrência, mudança de plano, módulos, armazenamento e cotas reais sem cobrança ou chamada ao provedor de IA.

Publicar frontend e backend juntos. Esta alteração não exige migration de banco.
