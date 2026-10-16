# Manual e Tutorial Completo — Painel Super Administrador | Nacif Electric

Guia oficial e prático de acesso, configuração, governança de usuários e gestão de permissões na plataforma **Nacif Electric**.

---

## PARTE A: Como Acessar o Painel Super Admin

### 1. Qual é a URL exata do painel administrativo?
A URL oficial da interface administrativa é:
- **Ambiente Local:** `http://localhost:5173/super-admin`
- **Ambiente de Produção:** `https://seu-dominio.com.br/super-admin`

> **Nota de Segurança:** Caso um usuário comum ou não autenticado tente acessar diretamente a URL `/super-admin`, a aplicação bloqueia imediatamente o acesso e redireciona para a tela de erro de autorização (`/403 - Forbidden`).

---

### 2. Preciso utilizar o login normal do sistema?
**Sim.** Não existe um portal de login paralelo ou separado. O acesso administrativo é unificado através da tela de login oficial:
- Acesse `/login`.
- Informe seu e-mail e sua senha de acesso.
- Após o login, o sistema detecta automaticamente seus privilégios de **Super Administrador (Nível 1)**.
- O menu de perfil (no canto inferior esquerdo da barra lateral ou no avatar do topo direito) exibirá o botão destacado em roxo: **"Painel Super Admin"**.

---

### 3. Como transformo minha conta atual em Super Admin pela primeira vez?
Existem **duas formas seguras** de habilitar sua conta como Super Administrador:

#### Forma 1: Conta Padrão Pré-Provisionada (Recomendado para início rápido)
O sistema já vem configurado de fábrica com uma conta raiz pronta para uso:
- **E-mail:** `admin@nacif.com`
- **Senha:** `admin` (recomendamos alterar a senha no primeiro acesso)
- Essa conta já nasce com o papel `super_admin` e autoridade máxima.

#### Forma 2: Promover uma conta existente via Terminal
Se você já possui uma conta cadastrada com seu e-mail pessoal (ex: `gabriel@nacifelectric.com.br`), você pode promovê-la executando o utilitário nativo de provisionamento (veja o item 4).

---

### 4. Preciso executar algum comando no terminal?
Para promover qualquer usuário para Super Admin via terminal, execute na raiz do projeto:

```bash
node scripts/promote-super-admin.mjs seu-email@exemplo.com
```

**Exemplo real:**
```bash
node scripts/promote-super-admin.mjs gabriel@nacifelectric.com.br
```

O script confirmará a elevação de privilégios com o seguinte relatório:
```
=======================================================
⚡ NACIF ELECTRIC — PROVISIONAMENTO DE SUPER ADMIN
=======================================================
[+] Alvo selecionado: gabriel@nacifelectric.com.br
✅ O usuário foi autorizado e configurado como:
   • Nível: Super Administrador (Nível 1)
   • Papel: super_admin
   • Status: Ativo
```

---

### 5. Preciso alterar alguma informação no banco de dados?
Se o seu ambiente estiver conectado a um banco de dados PostgreSQL / Supabase, basta executar o seguinte comando SQL:

```sql
UPDATE users 
SET role = 'super_admin', is_super_admin = TRUE, status = 'active'
WHERE email = 'seu-email@exemplo.com';
```

No modo standalone / local do frontend, o script `node scripts/promote-super-admin.mjs` ou o login com `admin@nacif.com` já realiza essa configuração de forma 100% automática e persistente.

---

### 6. Como confirmar que minha conta possui as permissões corretas?
1. Faça login no sistema.
2. Observe o menu do usuário (avatar no canto superior direito ou no rodapé da barra lateral).
3. Você verá o item roxo exclusivo: **"Painel Super Admin"** com o ícone de escudo de segurança (`ShieldAlert`).
4. Clique no link ou navegue até `/super-admin`. Se o painel carregar com os 6 cards de indicadores e as 5 abas, sua conta está com **autoridade máxima validada**.

---

## PARTE B: Como Usar o Painel Super Admin

### 1. Como entrar no painel
- Clique no avatar no topo direito e selecione **"Painel Super Admin"**, ou navegue para `/super-admin`.
- O topo da tela apresentará a faixa escura institucional com a legenda: `PAINEL SUPER ADMINISTRADOR • Nível 1 • Autoridade Máxima`.
- Você terá à disposição 5 abas principais:
  1. **Dashboard Geral**
  2. **Gerenciamento de Usuários**
  3. **Níveis & Matriz de Permissões**
  4. **Histórico & Auditoria**
  5. **Configurações Administrativas**

---

### 2. Como criar um novo usuário
1. Na aba **"Gerenciamento de Usuários"**, clique no botão turquesa **"+ Novo Usuário"** no topo direito.
2. Preencha os campos obrigatórios:
   - **Nome Completo** (ex: `Roberto Ferreira`)
   - **E-mail de Acesso** (ex: `roberto@engenhariasolar.com.br`)
   - **Nível de Acesso (RBAC):** Selecione o papel desejado (`Super Administrador`, `Administrador`, `Usuário Padrão`, `Engenheiro Eletricista`, `Visualizador` ou um nível personalizado).
   - **Profissão / Cargo:** Selecione a especialidade técnica (`Projetista Elétrico`, `Engenheiro / Eletricista`, etc.).
   - **Senha Inicial:** Deixe em branco para que o sistema gere automaticamente uma senha temporária segura, ou digite uma senha provisória.
   - **Status da Conta:** `Ativo` ou `Pendente de Ativação`.
3. Clique em **"Cadastrar Usuário"**.
4. Uma tela de confirmação será exibida com as credenciais. Clique em **"Copiar Acesso"** para enviar os dados de login de forma segura para o colaborador.

---

### 3. Como editar um usuário existente
1. Na lista de usuários, localize o registro desejado através da barra de pesquisa ou filtros.
2. Na coluna **"Ações"** (à direita), clique no ícone de três pontos (`⋮`) e selecione **"Editar Cadastro"**.
3. No modal que se abrir, você poderá alterar:
   - Nome Completo
   - Nível de Acesso (RBAC)
   - Status da Conta (`Ativo`, `Bloqueado/Suspenso`, `Pendente`)
   - Profissão / Cargo
4. Clique em **"Salvar Alterações"**. A ação é auditada automaticamente no sistema.

---

### 4. Como alterar o nível de acesso de um usuário
- Abra o modal de edição de cadastro do usuário.
- No campo **"Nível de Acesso (RBAC)"**, selecione o novo papel:
  - **Super Administrador (Nível 1):** Acesso irrestrito a todos os módulos e configurações.
  - **Administrador (Nível 2):** Gestão operacional e projetos, sem acesso ao `/super-admin`.
  - **Usuário Padrão (Nível 3):** Ferramentas operacionais de cálculo e projetos.
  - **Visualizador (Nível 4):** Apenas leitura e consulta.
- Clique em **"Salvar Alterações"**.
> **Regra de Proteção Ativa:** O sistema impede que o último Super Administrador ativo seja rebaixado para um nível inferior, garantindo que o sistema nunca fique sem governança.

---

### 5. Como criar e configurar níveis personalizados
1. Acesse a aba **"Níveis & Matriz de Permissões"**.
2. Clique no botão turquesa **"+ Criar Novo Nível"**.
3. Informe o nome (ex: `Auditor Técnico NBR` ou `Técnico de Manutenção Solar`).
4. Selecione o nível hierárquico (Nível 2, 3 ou 4).
5. Descreva o propósito daquele perfil.
6. Na **Matriz de Permissões**, marque as caixas de seleção para cada módulo e ação:
   - **Visualizar:** permite abrir e consultar o módulo.
   - **Criar:** permite cadastrar novos elementos.
   - **Editar:** permite modificar elementos existentes.
   - **Excluir:** permite apagar registros.
   - **Administrar:** concede privilégios de gestão dentro daquele módulo.
7. Você também pode clicar nos botões rápidos **"Marcar Todos"** ou **"Desmarcar Todos"**.
8. Clique em **"Salvar Nível e Permissões"**.

---

### 6. Como conceder ou remover permissões
- Na aba **"Níveis & Matriz de Permissões"**, clique em **"Editar"** no card do papel desejado.
- Alterne as caixas de seleção da matriz para ativar ou revogar permissões nos módulos específicos (ex: liberar *Projeto Solar* e bloquear *Calculadora*).
- Salve as alterações. Todos os usuários vinculados àquele papel herdarão as permissões atualizadas instantaneamente.

---

### 7. Como bloquear um usuário
1. Na aba **"Gerenciamento de Usuários"**, clique no menu de ações (`⋮`) do usuário.
2. Selecione **"Bloquear / Suspender"**.
3. Confirme a operação no diálogo de segurança.
- **Efeito Imediato:** O status muda para `Bloqueado` (vermelho). O usuário é imediatamente desconectado e impedido de fazer login.
- **Integridade dos Dados:** Os projetos elétricos, diagramas e dados do usuário permanecem 100% preservados no banco de dados.

---

### 8. Como desbloquear um usuário
1. Localize o usuário bloqueado na tabela (você pode utilizar o filtro `Apenas Bloqueados`).
2. Clique no menu de ações (`⋮`) e selecione **"Desbloquear Usuário"**.
3. Confirme a operação. O status volta para `Ativo` (verde) e o usuário já pode acessar normalmente com sua senha.

---

### 9. Como excluir ou desativar uma conta
1. No menu de ações (`⋮`) do usuário, selecione **"Excluir Conta"**.
2. Leia o diálogo de confirmação crítica e clique em **"Confirmar Operação"**.
- **Exclusão Lógica e LGPD:** A conta é marcada com exclusão lógica (`is_deleted: true`, `status: suspended`).
- Os projetos, cálculos e relatórios já emitidos pelo usuário NÃO são destruídos, mantendo a rastreabilidade técnica dos projetos elétricos da empresa.
> **Proteção do Sistema:** O sistema não permite excluir o único Super Administrador ativo da plataforma.

---

### 10. Como consultar os registros de atividade (Auditoria)
1. Acesse a aba **"Histórico & Auditoria"**.
2. Você visualizará uma tabela em tempo real com todos os eventos administrativos:
   - Data e horário exatos.
   - Nome e e-mail do operador que executou a ação.
   - Ação executada (ex: `USER_CREATED`, `USER_SUSPENDED`, `USER_DELETED`, `USER_ROLE_CHANGED`, `PASSWORD_RESET_SENT`, `SETTINGS_UPDATED`).
   - Recurso afetado e detalhes explicativos.
3. Utilize o campo de busca ou o filtro de tipos de ação para auditar alterações específicas.
4. Clique em **"Atualizar Logs"** a qualquer momento para buscar os eventos mais recentes.

---

## PARTE C: Como Administrar Futuramente

### 1. Como cadastrar novos administradores
- Somente um Super Administrador pode cadastrar outro Administrador ou outro Super Administrador.
- Ao clicar em **"+ Novo Usuário"**, selecione o nível `Administrador` ou `Super Administrador`.
- Um Administrador comum tem acesso para operar projetos e prestar suporte aos usuários em `/avisos-erros`, mas não poderá criar outros administradores nem acessar o painel `/super-admin`.

---

### 2. Como proteger o acesso Super Admin
- Na aba **"Configurações Administrativas"**, habilite a opção **"Exigir Autenticação de Múltiplos Fatores (MFA)"**.
- Defina o **"Tempo Limite de Sessão"** (padrão recomendado: 60 minutos).
- Configure o **"Limite Máximo de Tentativas de Login"** (padrão: 5 tentativas) para proteger contra ataques de força bruta.
- Nunca compartilhe a senha de contas com privilégios Super Admin; crie contas individuais para cada administrador técnico da empresa.

---

### 3. Como recuperar o acesso caso exista algum problema
Se você perder a senha de uma conta ou um usuário esquecer a senha:
1. No painel Super Admin, clique no menu do usuário e escolha **"Redefinir Acesso"**.
2. Clique em **"Gerar Link Seguro"** e copie a URL de recuperação gerada para o usuário redefinir sua senha diretamente em `/reset-password`.
3. Se o próprio Super Admin perder o acesso, execute no terminal do servidor:
   ```bash
   node scripts/promote-super-admin.mjs seu-email@exemplo.com
   ```
   Isso restaurará os privilégios máximos para aquele e-mail imediatamente.

---

### 4. Quais arquivos e estruturas foram criados e modificados?
- **Páginas e Telas:**
  - `src/pages/SuperAdmin/index.jsx`: Painel principal com as 5 abas integradas.
  - `src/pages/SuperAdmin/modals/CreateUserModal.jsx`: Modal de cadastro seguro com credenciais.
  - `src/pages/SuperAdmin/modals/EditUserModal.jsx`: Modal de edição e alteração de papéis.
  - `src/pages/SuperAdmin/modals/ResetPasswordModal.jsx`: Modal de emissão de link de redefinição.
  - `src/pages/SuperAdmin/modals/RoleModal.jsx`: Modal da matriz de permissões RBAC.
- **Bibliotecas e Motores:**
  - `src/lib/rbac.js`: Catálogo de módulos, matriz de ações e perfis padrão.
  - `src/lib/auditLogger.js`: Motor de registro de auditoria em tempo real.
  - `src/lib/professionalAccess.js`: Guarda de rotas `isSuperAdmin` e `canAccessSuperAdmin`.
- **Backend e API:**
  - `src/api/backendClient.js`: Entidade `backend.entities.SuperAdmin` com regras de proteção ao último super admin e validação de sessão para usuários bloqueados.
- **Roteamento e Navegação:**
  - `src/App.jsx`: Rota protegida `/super-admin` com redirecionamento automático para `/403` para não-administradores.
  - `src/components/Layout.jsx`: Acesso rápido no menu de perfil do usuário.
- **Scripts e Migrations:**
  - `scripts/promote-super-admin.mjs`: Script CLI de provisionamento.
  - `src/db/migrations/20261016_create_super_admin_system.sql`: Script SQL do banco de dados.

---

### 5. Quais migrations devem ser executadas no banco de dados?
Para aplicar a modelagem no banco de dados PostgreSQL / Supabase em produção, execute:

```bash
psql -h <host> -U <usuario> -d <database> -f src/db/migrations/20261016_create_super_admin_system.sql
```

A migration criará as tabelas `roles`, `audit_logs`, `system_settings` e adicionará os campos `status`, `is_super_admin`, `custom_permissions`, `is_deleted` e `last_access` na tabela `users`.

---

### 6. Quais variáveis de ambiente precisam ser configuradas?
O sistema funciona de forma nativa e automática. Quando for conectar ao backend REST em produção, configure no arquivo `.env`:

```env
# URL da API REST Backend (opcional em modo standalone)
VITE_API_BASE_URL=https://api.nacifelectric.com.br
```

---

### 7. Como verificar se o sistema está funcionando corretamente em produção?
1. Execute a bateria de testes automatizados do sistema:
   ```bash
   node scripts/super-admin-smoke.mjs
   npm run test:orthogonal-router
   ```
2. Valide o bundle de produção:
   ```bash
   npm run build
   ```
3. Acesse `http://localhost:5173/super-admin` e verifique:
   - Contadores de indicadores refletindo os usuários reais.
   - Listagem, filtros e busca de usuários.
   - Criação de um usuário teste e gravação no log de auditoria.
   - Tentativa de bloqueio do último Super Admin retornando aviso de proteção.
