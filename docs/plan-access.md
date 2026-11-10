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

## Isolamento dos projetos por conta

As rotas de projetos (lista, detalhes, revisões, alteração, duplicação e exclusão) e a autorização de exportação exigem que o usuário autenticado seja o criador. Os papéis admin e super_admin não ampliam o escopo da área Meus Projetos.

Em produção, o frontend usa exclusivamente os projetos retornados pela API. Registros antigos no localStorage não são mesclados nem usados como fallback de leitura ou escrita. Eles não são apagados automaticamente. No modo local de testes, projetos sem proprietário ou de outro usuário também são inacessíveis. O cache de consultas é limpo ao sair ou trocar de conta.

### Publicação da correção de isolamento

Publicar o frontend e reiniciar o backend é obrigatório: alterar somente os arquivos não atualiza um processo Node já iniciado. Na pasta do projeto no servidor, executar `npm run build` (o postbuild prepara e recarrega a API); confirmar nos logs que o backend iniciou corretamente. Em instalações PM2, pode-se verificar com `pm2 status nacif-electric-api`.

A resposta autenticada de `/api/projects` deve conter `X-Project-Isolation: owner-v2` e `Cache-Control: private, no-store`. Sem esse marcador, a requisição está chegando a uma versão antiga ou a outro backend/proxy. O frontend valida `owner_id` com o ID retornado por `/api/auth/me`, ignora registros sem proprietário e impede que uma resposta iniciada na sessão anterior seja exibida.
