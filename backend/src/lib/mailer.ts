import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env.js";

// Cache do transportador para reaproveitar conexões SMTP em vez de recriar a cada requisição
let cachedTransporter: Transporter | null = null;

/**
 * Verifica se todas as variáveis essenciais de SMTP foram fornecidas no .env
 */
export const isSmtpConfigured = (): boolean => {
  return Boolean(
    env.SMTP_HOST &&
      env.SMTP_PORT &&
      env.SMTP_USER &&
      env.SMTP_PASS,
  );
};

/**
 * Cria ou retorna a instância ativa do cliente SMTP (Nodemailer Transporter)
 */
export const getSmtpTransporter = (): Transporter | null => {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!cachedTransporter) {
    try {
      cachedTransporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        // Porta 465 geralmente exige SSL direto (secure: true). Porta 587 usa STARTTLS (secure: false).
        secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        // Timeouts para evitar travamento da requisição caso o servidor SMTP esteja instável
        connectionTimeout: 10000, // 10 segundos para estabelecer conexão TCP
        greetingTimeout: 10000,   // 10 segundos para resposta inicial do servidor
        socketTimeout: 15000,     // 15 segundos para tráfego de dados
      });
    } catch (err) {
      console.error("[SMTP Mailer] Falha ao instanciar transportador Nodemailer:", err);
      return null;
    }
  }

  return cachedTransporter;
};

export interface SendPasswordResetEmailParams {
  to: string;
  userName?: string | null;
  resetLink: string;
}

export interface SendEmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Dispara o e-mail de recuperação de senha com layout HTML responsivo e versão em texto puro.
 * NUNCA lança exceção não tratada: em caso de erro, captura e retorna { sent: false, error }.
 */
export const sendPasswordResetEmail = async ({
  to,
  userName,
  resetLink,
}: SendPasswordResetEmailParams): Promise<SendEmailResult> => {
  try {
    // 1. Checa se o SMTP está configurado
    if (!isSmtpConfigured()) {
      console.error(
        "[SMTP Mailer] Credenciais SMTP ausentes nas variáveis de ambiente (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS). E-mail não pôde ser disparado para:",
        to,
      );
      return {
        sent: false,
        error: "Credenciais SMTP não configuradas no servidor.",
      };
    }

    // 2. Obtém o transportador
    const transporter = getSmtpTransporter();
    if (!transporter) {
      console.error("[SMTP Mailer] Falha ao inicializar o transporter do Nodemailer.");
      return {
        sent: false,
        error: "Transporter SMTP indisponível.",
      };
    }

    const senderAddress =
      env.SMTP_FROM || `"Nacif Energy" <${env.SMTP_USER}>`;
    const displayName = userName?.trim() || to.split("@")[0];

    // 3. Monta o template de e-mail em HTML (estilizado na paleta do Nacif Energy)
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinição de Senha - Nacif Energy</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
          <tr>
            <td>
              <h1 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">Redefinição de senha</h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">
                Olá, <strong>${displayName}</strong>!
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">
                Recebemos uma solicitação para redefinir a senha da sua conta na plataforma <strong>Nacif Energy</strong>. Clique no botão abaixo para criar uma nova senha:
              </p>
              <p style="margin: 0 0 24px; text-align: center;">
                <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #00d8b8; color: #020617; font-weight: bold; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px;">
                  Redefinir minha senha
                </a>
              </p>
              <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #64748b;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all; color: #00a98e;">
                <a href="${resetLink}" style="color: #00a98e;">${resetLink}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">
                Este link é válido por <strong>1 hora</strong> e pode ser utilizado apenas uma vez. Caso você não tenha solicitado a redefinição de senha, ignore este e-mail com segurança.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // 4. Versão em texto puro para clientes de e-mail que não suportam HTML
    const text = [
      `Olá, ${displayName}!`,
      "",
      "Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Nacif Energy.",
      "Acesse o link abaixo para criar uma nova senha (válido por 1 hora):",
      resetLink,
      "",
      "Se você não solicitou esta alteração, ignore este e-mail.",
    ].join("\n");

    // 5. Envio assíncrono via Nodemailer
    const info = await transporter.sendMail({
      from: senderAddress,
      to,
      subject: "Redefinição de senha — Nacif Energy",
      text,
      html,
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    // 6. Tratamento de erro detalhado para não quebrar a aplicação
    console.error("[SMTP Mailer] Erro ao enviar e-mail de redefinição de senha via SMTP:", {
      recipient: to,
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
      smtpSecure: env.SMTP_SECURE,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Falha na comunicação com o servidor SMTP.",
    };
  }
};

