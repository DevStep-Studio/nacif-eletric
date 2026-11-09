# Pagamentos Asaas

## Configuração

O template fica neste guia; o arquivo real `backend/.env` deve permanecer fora do
versionamento. Não é necessário versionar um arquivo `.env.example` do backend.

1. Crie uma conta [sandbox](https://sandbox.asaas.com/) e gere uma API key.
2. Em `backend/.env`, configure:

   ```dotenv
   ASAAS_ENVIRONMENT=sandbox
   ASAAS_API_KEY=<chave da conta sandbox>
   ASAAS_WEBHOOK_TOKEN=<token aleatório exclusivo de 32 a 255 caracteres sem espaços>
   FRONTEND_URL=https://seu-dominio.com.br
   ```

   Gere o token com `openssl rand -hex 32`. Ele é diferente da API key. Nunca use
   prefixo `VITE_` para credenciais Asaas. Não coloque segredos no Git ou em logs.
3. Configure o domínio comercial na conta Asaas para permitir a URL de retorno.
   Confira a habilitação de cartão recorrente e tokenização na conta: o cartão é
   informado na fatura do Asaas; a aplicação não captura nem armazena seu número.
4. Instale as dependências e gere o cliente Prisma com os comandos abaixo.
5. Configure um webhook HTTPS público (em desenvolvimento, utilize um túnel para
   a API local) para `https://sua-api/api/subscriptions/webhook/asaas`, com o mesmo
   token em **Auth Token**, API v3 e envio sequencial. Ative:

   ```text
   PAYMENT_CREATED
   PAYMENT_UPDATED
   PAYMENT_CONFIRMED
   PAYMENT_RECEIVED
   PAYMENT_OVERDUE
   PAYMENT_DELETED
   PAYMENT_REFUNDED
   PAYMENT_CHARGEBACK_REQUESTED
   PAYMENT_CHARGEBACK_DISPUTE
   PAYMENT_AWAITING_CHARGEBACK_REVERSAL
   SUBSCRIPTION_CREATED
   SUBSCRIPTION_UPDATED
   SUBSCRIPTION_INACTIVATED
   SUBSCRIPTION_DELETED
   ```

   Se disponíveis, habilite também `PAYMENT_RESTORED`, `PAYMENT_RECEIVED_IN_CASH_UNDONE`,
   `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_REFUND_DENIED` e `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`.
   Eventos adicionais de cobrança são aceitos: o servidor consulta o estado atual
   do Asaas, em vez de confiar na ordem ou no status antigo contido no evento.

## Banco e publicação

```bash
npm ci --ignore-scripts
npm --prefix backend ci
npm --prefix backend run prisma:generate
```

A alteração adiciona `billing_accounts`, `billing_subscriptions`, `billing_payments`
e `billing_events`. Não remove usuários, planos nem o histórico antigo de eventos.

O repositório não tem uma migration inicial completa. Em um banco existente,
aplique **somente** `backend/prisma/migrations/20261109000000_asaas_billing/migration.sql`
pelo procedimento SQL adotado pela operação, após backup. Se o banco já possui
baseline e histórico Prisma reconciliado, utilize `prisma migrate deploy` dentro
de `backend`. Em um banco novo ou descartável, use `npm --prefix backend run prisma:push`.
Não execute indiscriminadamente todas as migrations históricas em banco sem baseline.

```bash
npm --prefix backend run typecheck
npm --prefix backend run test:billing
node scripts/api-client-integration.mjs
node node_modules/vite/bin/vite.js build
npm --prefix backend run asaas:check
```

O build direto acima evita o `postbuild`, que inicia a API de produção.
Reinicie a API depois de aplicar o SQL e configurar as variáveis.

Para produção, use `ASAAS_ENVIRONMENT=production` e uma chave da conta de produção;
os endpoints são `https://api.asaas.com/v3` e `https://api-sandbox.asaas.com/v3`.
Sandbox e produção têm registros independentes. Para staging com
`NODE_ENV=production`, sandbox exige `ALLOW_SANDBOX_ASAAS=true`.

## Funcionamento

- Preços são lidos do catálogo no servidor. Estudante é exclusivamente mensal e
  depende de comprovação acadêmica aprovada e válida.
- O formulário solicita CPF/CNPJ, telefone e endereço de cobrança, enviados ao Asaas.
  Cartão, Pix e boleto são pagos na fatura hospedada retornada em `invoiceUrl`.
- A primeira cobrança vence em três dias. Criar assinatura não libera acesso.
  Após o primeiro pagamento, os próximos vencimentos são alinhados ao início
  do período pago, evitando lacuna entre ciclos.
  `CONFIRMED`, `RECEIVED` e `RECEIVED_IN_CASH` confirmam o período pago.
- Pix e boleto geram cobranças periódicas com pagamento manual e avisos enviados
  pelo Asaas. O usuário pode abrir a cobrança em **Gerenciar assinatura**.
- Acesso pago expira pela data do período, mesmo sem novos webhooks. O login não
  concede plano pago. Contas administrativas mantêm acesso completo.
- Cancelamento inativa a recorrência, cancela cobranças ainda não pagas e preserva
  períodos pagos. Se houver análise financeira em andamento, o aplicativo informa
  que é necessário aguardar; não simula cancelamento bem-sucedido.
- Alterações de plano/ciclo atualizam a recorrência e cobranças futuras pendentes,
  sem pró-rata. O plano atual continua até o término do período pago; o novo plano
  só é liberado com a confirmação da nova cobrança. A data é exibida na aplicação.
- Estornos e contestações removem somente o direito associado à cobrança afetada.
  Projetos são preservados. O plano gratuito permite um projeto, 100 MB e três
  exportações mensais; IA e módulos solares exigem assinatura. Os limites dos
  planos comerciais existentes foram preservados.

## Recuperação e validação em sandbox

O servidor salva a intenção antes de criar cliente/assinatura e utiliza
`externalReference` para recuperar operações interrompidas. Há bloqueio persistido
por conta para serializar chamadas simultâneas e deduplicação transacional de eventos.

Se ocorrer timeout, a próxima tentativa consulta o Asaas antes de criar qualquer
coisa. Se o resultado continuar desconhecido, a criação fica bloqueada com mensagem
de conciliação. Confira a referência local no painel Asaas; **não** limpe os flags
`customerAttempted`/`createAttempted` sem comprovar que a operação anterior não existe.
Falhas explícitas de validação permitem corrigir os dados e tentar novamente.
Cancelamentos parcialmente concluídos podem ser repetidos para finalizar a limpeza.

Antes de ativar produção, valide com sua conta sandbox: pagamento e renovação nos
três métodos, fatura de cartão e autorização da recorrência, boleto pendente e
compensado, comprovante acadêmico, troca mensal/anual, cancelamento e estorno.
Confirme também reenvio de webhook, token incorreto e retorno antes da compensação.
Os testes automatizados usam uma API Asaas simulada e não substituem essa homologação.
Há também `npm --prefix backend run test:billing:mysql`, que verifica concorrência,
transações, valores decimais e JSON com MySQL real; execute somente com
`DATABASE_URL` apontando para banco descartável cujo nome termine em `_test`.

Referências oficiais: [assinaturas](https://docs.asaas.com/docs/assinaturas),
[retorno da fatura](https://docs.asaas.com/docs/redirecionamento-apos-o-pagamento),
[atualização de assinatura](https://docs.asaas.com/reference/update-existing-subscription)
e [webhooks](https://docs.asaas.com/reference/create-new-webhook).

## Verificações realizadas nesta migração

- 29 testes automatizados de cobrança e autenticação, com API Asaas simulada.
- 98 verificações da API com MySQL isolado, além do teste de cobrança com concorrência
  real, isolamento entre contas, deduplicação, valores decimais e alterações em JSON.
- Aplicação do SQL sobre o schema anterior em MySQL isolado; comparação Prisma
  com o schema novo sem diferenças.
- Typecheck do backend, lint dos arquivos de frontend alterados, cliente HTTP,
  verificação de readiness e build de produção do frontend.

O typecheck global do frontend já apresenta milhares de diagnósticos no código
anterior, principalmente nas tipagens dos componentes de interface; ele continua
pendente de uma correção própria. O lint global também aponta imports não usados
em arquivos fora desta migração. O acesso ao navegador de testes estava indisponível,
portanto não foi realizada validação visual. Nenhuma cobrança real foi criada e
nenhuma alteração foi aplicada ao banco de produção. A homologação com as credenciais
da conta Asaas permanece necessária antes de receber pagamentos reais.
