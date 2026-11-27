---
trigger: always_on
---

# Auto-Commit Rule

Sempre que concluir um ajuste, correção, melhoria ou implementação no projeto:

1. Verifique as alterações pendentes via `git --no-pager status --short --branch`.
2. Adicione os arquivos alterados ao stage (`git add <arquivos>`).
3. Realize o commit com uma mensagem descritiva (Conventional Commits: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`) e envie com `$env:GIT_TERMINAL_PROMPT="0"; $env:GCM_INTERACTIVE="never"; git push origin main` usando `WaitMsBeforeAsync: 10000` para concluir de forma síncrona sem deixar tasks em background (`1 task running`).
4. Informe ao usuário o hash ou a mensagem do commit realizado.
