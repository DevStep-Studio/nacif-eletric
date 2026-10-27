import React, { useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [recoveryLink, setRecoveryLink] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setRecoveryLink("");
    setLoading(true);
    try {
      const result = await backend.auth.resetPasswordRequest(email);
      setRecoveryLink(result?.recoveryLink || "");
      setSent(true);
    } catch (err) {
      setError(err.message || "Não foi possível enviar a recuperação de senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Redefinir senha"
      subtitle="Enviaremos um link para você definir uma nova senha."
      footer={
        <p className="text-center text-xs text-slate-500">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o login
          </Link>
        </p>
      }
    >
      {error && (
        <div role="alert" className="mb-5 rounded-[8px] border border-red-200/80 bg-red-50 p-3 text-xs font-semibold text-red-600 animate-in fade-in">
          {error}
        </div>
      )}

      {sent ? (
        <div className="space-y-4 text-center animate-in fade-in">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#00d8b8]/15 text-[#00a98e]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-700 leading-relaxed">
            Se existir uma conta com o e-mail informado, você receberá o link de redefinição em instantes.
          </p>
          {recoveryLink && (
            <div className="rounded-[12px] border border-[#00d8b8]/30 bg-[#00d8b8]/5 p-4 text-left">
              <p className="text-xs font-bold text-slate-900">Ambiente local detectado</p>
              <p className="mt-1 text-xs text-slate-600">
                Para contas criadas neste navegador, use o link direto abaixo.
              </p>
              <a 
                href={recoveryLink} 
                className="mt-3 inline-block text-xs font-bold text-[#00a98e] hover:underline"
              >
                Redefinir senha agora →
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[48px] rounded-[8px] border-slate-200 bg-slate-50/90 pl-10 pr-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/20 transition-all outline-none shadow-none"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <Button 
              type="submit" 
              disabled={loading}
              className="h-[48px] w-full rounded-[8px] bg-[#00d8b8] hover:bg-[#00c5a7] active:bg-[#00b397] text-slate-950 font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(0,216,184,0.25)] hover:shadow-[0_6px_20px_rgba(0,216,184,0.35)] transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Enviando...</span>
                </span>
              ) : (
                "Enviar link de recuperação"
              )}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
