# Diretrizes do Projeto Nacif Eletric

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
