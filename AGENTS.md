# Diretrizes do Projeto Nacif Eletric

## Regra de Execução Direta e Autônoma (Autonomous Execution)

> **IMPORTANTE**: O usuário NÃO deseja ser perguntado se pode prosseguir ou se precisa de confirmação antes de implementar.
> 1. Execute o código e as alterações solicitadas imediatamente de ponta a ponta.
> 2. Não crie pausas conversacionais de "podemos prosseguir?" ou "posso implementar?".
> 3. Entregue a tarefa pronta, validada e commitada.

## Regra de Auto-Commit Obrigatório (Automated Git Commits)

> **IMPORTANTE**: Sempre que você (agente) concluir qualquer ajuste, correção de bug, nova funcionalidade, refatoração ou alteração no código solicitado pelo usuário:
>
> 1. **Verificar alterações**: Execute `git status` e `git diff` para revisar os arquivos alterados.
> 2. **Stage dos arquivos**: Adicione os arquivos modificados usando `git add <arquivos>` (ou `git add .` respeitando o `.gitignore`).
> 3. **Realizar commit imediatamente**: Crie um commit com mensagem clara e objetiva seguindo o padrão Conventional Commits (em português ou inglês):
>    - `feat: <descrição>` para novas funcionalidades
>    - `fix: <descrição>` para correções de bugs
>    - `style: <descrição>` para ajustes de layout, cores, CSS
>    - `refactor: <descrição>` para refatorações de código
>    - `chore: <descrição>` para alterações de build, configs ou dependências
> 4. **Não finalizar a resposta sem commitar**: Nunca encerre a resposta de um ajuste sem ter efetuado o commit das alterações realizadas.

## Validação e commit ao concluir tarefas

Aplique a rotina abaixo a toda tarefa futura que altere arquivos do projeto:

### AO INICIAR UMA TAREFA
1. Confirme a raiz do repositório com `git rev-parse --show-toplevel`. Confira a branch atual e o estado dos arquivos com `git status --short --branch`. Se estiver operando pelo `Cerebro2`, execute esses comandos na pasta do projeto indicado no cartão.
2. Registre quais alterações já existiam, inclusive as que já estavam em staging. Preserve o trabalho anterior do usuário.

### AO CONCLUIR UMA TAREFA
3. Revise o diff e confira se ele atende ao pedido. Execute os testes pertinentes disponíveis no projeto. Para mudanças visuais, valide desktop (`1440×900`) e celular (`390×844`) e teste a interação afetada. Se uma verificação necessária falhar, tente corrigir e repita. Se continuar bloqueada, preserve o trabalho e informe a pendência antes de criar o commit.
4. Selecione somente as alterações desta tarefa. Revise o conteúdo exato que entrará no commit, incluindo arquivos novos. Mantenha fora dele credenciais, arquivos `.env` locais, logs e capturas temporárias. Respeite as convenções do repositório para evidências versionadas.
5. Crie automaticamente um commit com mensagem curta que descreva a entrega, seguindo o padrão existente no histórico (ex.: `"Refina o cabeçalho de notificações e perfil"` ou `style: refina o cabeçalho de notificações e perfil`). Se já houver staging de outro trabalho, preserve-o e faça o commit de forma isolada. Se o mesmo trecho tiver edições anteriores que não possam ser separadas com segurança, deixe-o pendente e explique.
6. Após o commit, confira os arquivos registrados com `git show --stat --oneline HEAD` e verifique o estado final com `git status --short --branch`. Informe projeto, branch, hash curto, mensagem, testes executados e eventuais pendências.
7. Se a tarefa foi apenas uma consulta ou não produziu alterações, encerre sem commit vazio. Push, merge, deploy e publicação dependem de solicitação explícita.

