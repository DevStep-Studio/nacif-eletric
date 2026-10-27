import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await backend.auth.resetPassword({ resetToken, newPassword });
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        title="Link inválido"
        subtitle="Este link de redefinição de senha está ausente ou expirou."
        footer={
          <p className="text-center text-xs text-slate-500">
            <Link 
              to="/forgot-password" 
              className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors"
            >
              Solicitar novo link de recuperação
            </Link>
          </p>
        }
      >
        <div className="text-center py-4 space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600 leading-relaxed">
            O link utilizado parece estar incorreto ou já expirou. Por favor, solicite um novo link de redefinição.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nova senha"
      subtitle="Defina sua nova senha para continuar seus projetos."
      footer={
        <p className="text-center text-xs text-slate-500">
          Lembrou da senha?{" "}
          <Link 
            to="/login" 
            className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors"
          >
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nova senha */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
            Nova senha
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-[48px] rounded-[8px] border-slate-200 bg-slate-50/90 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/20 transition-all outline-none shadow-none"
              required
            />
            <button
              type="button"
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]/40"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirmar nova senha */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="confirm" className="text-xs font-semibold text-slate-700">
            Confirmar nova senha
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
            <Input
              id="confirm"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-[48px] rounded-[8px] border-slate-200 bg-slate-50/90 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/20 transition-all outline-none shadow-none"
              required
            />
            <button
              type="button"
              title={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]/40"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Botão Redefinir senha */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="h-[48px] w-full rounded-[8px] bg-[#00d8b8] hover:bg-[#00c5a7] active:bg-[#00b397] text-slate-950 font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(0,216,184,0.25)] hover:shadow-[0_6px_20px_rgba(0,216,184,0.35)] transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Redefinindo...</span>
              </span>
            ) : (
              "Redefinir senha"
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
