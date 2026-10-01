---
trigger: always_on
---

# Auto-Commit Rule

Sempre que concluir um ajuste, correção, melhoria ou implementação no projeto:

1. Verifique as alterações pendentes via `git status`.
2. Adicione os arquivos alterados ao stage (`git add`).
3. Realize o commit com uma mensagem descritiva (Conventional Commits: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`).
4. Informe ao usuário o hash ou a mensagem do commit realizado.
