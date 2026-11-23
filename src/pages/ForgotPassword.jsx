import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [recoveryLink, setRecoveryLink] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setRecoveryLink("");
    setEmailSent(false);
    setLoading(true);
    try {
      const result = await backend.auth.forgotPassword(email);
      setRecoveryLink(result?.recoveryLink || "");
      setEmailSent(Boolean(result?.emailSent));
      setSent(true);
    } catch (err) {
      setError(err.message || "Não foi possível enviar a recuperação de senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headingId="forgot-heading"
      title="Recuperar senha"
      subtitle={
        sent
          ? emailSent
            ? "Verifique sua caixa de entrada para continuar com a redefinição."
            : "Solicitação registrada para o endereço informado."
          : "Informe seu e-mail cadastrado e enviaremos um link para você definir uma nova senha."
      }
      error={error}
      afterContent={
        <>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#DCE4EC]" aria-hidden="true" />
            <span className="text-xs font-medium text-[#64748B]">ou</span>
            <span className="h-px flex-1 bg-[#DCE4EC]" aria-hidden="true" />
          </div>

          <Button
            asChild
            variant="outline"
            className="h-[52px] w-full rounded-[12px] border-[#DCE4EC] bg-white text-[15px] font-bold text-[#081827] shadow-none transition-colors hover:border-[#00d8b8]/60 hover:bg-[#00d8b8]/5 hover:text-[#081827] sm:h-[54px]"
          >
            <Link to="/login" className="inline-flex items-center justify-center gap-2">
              <ArrowLeft className="h-[18px] w-[18px] text-[#081827]" aria-hidden="true" />
              <span>Voltar para o login</span>
            </Link>
          </Button>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-[#00d8b8]/35 bg-[#00d8b8]/10 p-4 text-left">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-[#008C77]"
              aria-hidden="true"
            />
            <p className="text-sm font-medium leading-relaxed text-[#081827]">
              Se existir uma conta com o e-mail informado, você receberá o link de
              redefinição em instantes.
            </p>
          </div>

          {recoveryLink && (
            <div className="rounded-xl border border-[#DCE4EC] bg-[#F8FAFC] p-4 text-left">
              <p className="text-xs font-bold text-[#081827]">
                Link direto de recuperação
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                Se o e-mail não chegar em sua caixa de entrada ou se o serviço SMTP ainda
                estiver em configuração, acesse diretamente pelo link abaixo:
              </p>
              <a
                href={recoveryLink}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#009E86] hover:text-[#007D6A] hover:underline"
              >
                <span>Redefinir senha agora</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <Label htmlFor="email" className="text-[13px] font-bold text-[#101828]">
              E-mail
            </Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-[#DCE4EC] bg-white pl-11 pr-4 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/25"
                required
              />
            </div>
          </div>

          <div className="pt-1.5">
            <Button
              type="submit"
              disabled={loading}
              className="h-[54px] w-full rounded-[12px] border-0 bg-[#00d8b8] px-5 text-[15px] font-extrabold text-[#031923] shadow-[0_8px_20px_rgba(0,216,184,0.28)] transition-colors hover:bg-[#00c4a7] active:bg-[#00b095] focus-visible:ring-2 focus-visible:ring-[#00d8b8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:h-[56px]"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                  <span>Enviando...</span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <span>Enviar link de recuperação</span>
                  <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              )}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
