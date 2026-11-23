import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        headingId="invalid-token-heading"
        title="Link inválido"
        subtitle="Este link de redefinição de senha está ausente ou expirou."
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
              className="h-[52px] w-full rounded-[12px] border-[#DCE4EC] bg-white text-[15px] font-bold text-[#081827] shadow-none transition-colors hover:border-[#00d8b8]/60 hover:bg-[#00d8b8]/5 hover:text-[#081827]"
            >
              <Link to="/login" className="inline-flex items-center justify-center gap-2">
                <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                <span>Voltar para o login</span>
              </Link>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-[#FFF3E6] p-4 text-left">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <p className="text-sm font-medium leading-relaxed text-[#081827]">
              O link utilizado parece estar incorreto ou já expirou. Solicite um novo link
              de redefinição para cadastrar uma nova senha.
            </p>
          </div>

          <Button
            asChild
            className="h-[52px] w-full rounded-[12px] border-0 bg-[#00d8b8] px-5 text-[15px] font-extrabold text-[#031923] shadow-[0_8px_20px_rgba(0,216,184,0.28)] transition-colors hover:bg-[#00c4a7]"
          >
            <Link to="/forgot-password" className="inline-flex items-center justify-center gap-2">
              <span>Solicitar novo link</span>
              <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      headingId="reset-heading"
      title="Nova senha"
      subtitle="Defina sua nova senha para continuar seus projetos na plataforma."
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
            className="h-[52px] w-full rounded-[12px] border-[#DCE4EC] bg-white text-[15px] font-bold text-[#081827] shadow-none transition-colors hover:border-[#00d8b8]/60 hover:bg-[#00d8b8]/5 hover:text-[#081827]"
          >
            <Link to="/login" className="inline-flex items-center justify-center gap-2">
              <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>Voltar para o login</span>
            </Link>
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nova senha */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="password" className="text-[13px] font-bold text-[#101828]">
            Nova senha
          </Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-12 rounded-xl border-[#DCE4EC] bg-white pl-11 pr-11 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/25"
              required
            />
            <button
              type="button"
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>

        {/* Confirmar nova senha */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="confirm" className="text-[13px] font-bold text-[#101828]">
            Confirmar nova senha
          </Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <Input
              id="confirm"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 rounded-xl border-[#DCE4EC] bg-white pl-11 pr-11 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/25"
              required
            />
            <button
              type="button"
              title={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>

        {/* Botão Redefinir senha com cor primária oficial #00d8b8 */}
        <div className="pt-1.5">
          <Button
            type="submit"
            disabled={loading}
            className="h-[54px] w-full rounded-[12px] border-0 bg-[#00d8b8] px-5 text-[15px] font-extrabold text-[#031923] shadow-[0_8px_20px_rgba(0,216,184,0.28)] transition-colors hover:bg-[#00c4a7] active:bg-[#00b095] focus-visible:ring-2 focus-visible:ring-[#00d8b8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:h-[56px]"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                <span>Redefinindo...</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <span>Redefinir senha</span>
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
