# Nacif Electric — Segurança Cibernética, Governança & Performance

Este documento descreve os padrões criptográficos, protocolos de autenticação, controles de acesso, conformidade com a LGPD e níveis de serviço (SLAs) implementados no ecossistema da plataforma **Nacif Electric**.

---

## 1. Padrões Criptográficos e Hashing de Senhas

### 1.1 Algoritmo PBKDF2 com HMAC-SHA256
Em consonância com as diretrizes do NIST SP 800-132 e a implementação do cliente frontend [`src/lib/securityCrypto.js`](../src/lib/securityCrypto.js), o sistema adota:
- **Primitiva Criptográfica:** PBKDF2 (Password-Based Key Derivation Function 2) com HMAC-SHA256.
- **Número de Iterações:** 100.000 iterações (resistente a ataques de força bruta com hardware dedicado/GPU).
- **Salitre Criptográfico (Salt):** 16 bytes (128 bits) gerados aleatoriamente via gerador de números pseudoaleatórios criptograficamente seguro (`crypto.getRandomValues` / `crypto.randomBytes`).
- **Comprimento da Chave Derivada:** 32 bytes (256 bits).
- **Formato Serializado de Armazenamento:**
  `pbkdf2:100000:<salt_hex>:<hash_hex>`
- **Fallback / Retrocompatibilidade:** Suporte nativo à verificação e migração automática de hashes legacy no padrão Bcrypt (fator de custo 10).

### 1.2 Proteção de Dados em Trânsito e em Repouso
- **Trânsito:** HTTPS obrigatório em produção com TLS 1.3 e cabeçalhos de segurança (HSTS, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options).
- **Repouso:** Campos de dados altamente sensíveis utilizam criptografia simétrica autenticada **AES-256-GCM** com vetor de inicialização (IV) de 12 bytes e tag de autenticação de 16 bytes.

---

## 2. Ciclo de Vida da Sessão & Prevenção contra Força Bruta

| Parâmetro | Valor Configurado | Descrição |
| :--- | :--- | :--- |
| **Duração do Access Token (JWT)** | 24 Horas (`SESSION_EXPIRATION_MS`) | Sessão autenticada ativa no navegador |
| **Duração do Token de Recuperação**| 1 Hora (`RESET_TOKEN_EXPIRATION_MS`) | Validade de uso único para redefinição de senha |
| **Limite de Tentativas de Login** | 5 Tentativas (`MAX_LOGIN_ATTEMPTS`) | Contador de falhas consecutivas antes do bloqueio |
| **Janela de Bloqueio por Força Bruta**| 15 Minutos (`LOGIN_LOCKOUT_MS`) | Bloqueio temporário da conta ao exceder tentativas |

---

## 3. Matriz de Controle de Acesso Baseado em Papéis (RBAC)

O acesso às rotas e recursos do sistema segue a matriz de autorização estrita:

| Recurso / Ação | `user` | `admin` | `super_admin` | Regra de Aplicação |
| :--- | :---: | :---: | :---: | :--- |
| **Criar/Editar Projetos Próprios** | ✅ | ✅ | ✅ | Cláusula `ownerId === user.id` |
| **Visualizar Projetos de Terceiros** | ❌ | ✅ | ✅ | Bloqueio IDOR para `user` comum |
| **Criar/Editar Orçamentos** | ✅ | ✅ | ✅ | Isolamento por proprietário do orçamento |
| **Relatar Erro/Aviso na Central** | ✅ | ✅ | ✅ | Qualquer usuário autenticado |
| **Alterar Status de Tickets de Suporte**| ❌ | ✅ | ✅ | Restrito à equipe técnica/gestão |
| **Inserir Nota Interna em Tickets** | ❌ | ✅ | ✅ | Visível apenas para administradores |
| **Visualizar Trilha de Auditoria Geral**| ❌ | ❌ | ✅ | Restrito a Super Administradores |
| **Ativar / Suspender Usuários** | ❌ | ❌ | ✅ | Proteção de salvaguarda contra autoexclusão |
| **Exportar / Restaurar Backups** | ❌ | Apenas Export | ✅ Total | Restauração restrita a `super_admin` |
| **Alterar Configurações Globais (MFA)** | ❌ | ❌ | ✅ | Restrito a Super Administradores |

---

## 4. Proteção contra Insecure Direct Object References (IDOR)

Toda operação de leitura, atualização ou exclusão de registros protegidos (`/api/projects/:id`, `/api/budgets/:id`, `/api/issues/:id`) passa obrigatoriamente por verificação de titularidade no backend:
1. O registro solicitado é consultado no banco de dados.
2. Compara-se `record.ownerId` com `request.authUser.id`.
3. Se o solicitante não for o proprietário legítimo e não possuir privilégios `admin` ou `super_admin`, a requisição é terminada imediatamente com HTTP 403 (Forbidden).
4. O evento de tentativa de acesso não autorizado é gravado na trilha de auditoria para monitoramento de segurança.

---

## 5. Conformidade com a LGPD (Lei Geral de Proteção de Dados)

Em atendimento à Lei nº 13.709/2018 (LGPD), a plataforma disponibiliza mecanismos diretos para o exercício dos direitos dos titulares de dados:

1. **Direito à Portabilidade (Art. 18, V):**
   - Rota `GET /api/auth/export-data`: Gera arquivo JSON estruturado contendo a totalidade dos dados cadastrais, preferências, projetos, orçamentos e relatos vinculados ao titular.
2. **Direito ao Cancelamento e Exclusão (Art. 18, VI):**
   - Rota `DELETE /api/auth/me`: Executa a anonimização e cancelamento da conta, revogando todas as sessões ativas, marcando `is_deleted: true` e preservando unicamente memórias técnicas de cálculo exigidas por normas de engenharia (CREA/CONFEA).
3. **Registro de Consentimento e Finalidade:**
   - Termos de uso e políticas de privacidade com aceitação explícita armazenada em metadados de auditoria.

---

## 6. Integridade de Backups & Verificação SHA-256

Os procedimentos de exportação e restauração de dados (`/api/database/backup/*`) contam com validação de assinatura para evitar injeções ou corrupção de arquivos:
- Na exportação, um hash criptográfico **SHA-256** é calculado a partir de todos os registros serializados de usuários, projetos, orçamentos, notificações e logs.
- O hash é gravado no cabeçalho `checksum_sha256` do arquivo de backup.
- Na restauração, o backend recalcula integralmente o hash SHA-256 do corpo do arquivo e o compara com o cabeçalho. Em caso de divergência de 1 bit sequer, o processo é abortado imediatamente e revertido sem aplicar alterações à base.

---

## 7. Acordos de Nível de Serviço (SLAs) para Resposta a Incidentes

Conforme estabelecido na política de resposta a incidentes da Nacif Electric ([`src/lib/incidentResponse.js`](../src/lib/incidentResponse.js)):

| Severidade | Descrição do Impacto | Tempo Máximo de Resposta | Tempo Máximo de Resolução |
| :---: | :--- | :---: | :---: |
| **P1 - Crítica** | Indisponibilidade total do sistema ou corrupção de cálculos elétricos centrais | **< 1 Hora** | **< 4 Horas** |
| **P2 - Alta** | Falha de persistência, bloqueio em orçamentos ou inconsistência de circuitos | **< 4 Horas** | **< 12 Horas** |
| **P3 - Média** | Lentidão na interface, falha de exportação de PDF ou inconformidade visual | **< 12 Horas** | **< 24 Horas** |
| **P4 - Baixa** | Dúvidas operacionais, melhorias de UX e ajustes cosméticos | **< 48 Horas** | **< 5 Dias Úteis** |
