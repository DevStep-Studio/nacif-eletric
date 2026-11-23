import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { backend, isLocalAuthMode } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";
import {
  PENDING_REGISTER_PROFESSION_KEY,
  PROFESSIONS,
  getDefaultAuthenticatedRoute,
  normalizeProfession,
} from "@/lib/professionalAccess";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profession, setProfession] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    const normalizedProfession = normalizeProfession(profession);
    if (!normalizedProfession) {
      setError("Selecione sua profissão para definir os acessos da conta.");
      return;
    }
    if (!termsAccepted) {
      setError(
        "Você deve ler e concordar com os Termos de Uso e a Política de Privacidade para criar uma conta."
      );
      return;
    }
    setLoading(true);
    try {
      window.localStorage.setItem(PENDING_REGISTER_PROFESSION_KEY, normalizedProfession);
      const result = await backend.auth.register({
        email,
        password,
        profession: normalizedProfession,
        terms_accepted: true,
        terms_version: "1.2",
        terms_accepted_at: new Date().toISOString(),
      });
      if (isLocalAuthMode || (result?.access_token && !result?.requires_otp)) {
        if (result?.access_token) {
          backend.auth.setToken(result.access_token);
        }
        if (
          isLocalAuthMode ||
          normalizeProfession(result?.user?.profession || result?.user?.profissao) ===
            normalizedProfession
        ) {
          window.localStorage.removeItem(PENDING_REGISTER_PROFESSION_KEY);
        }
        window.location.href = getDefaultAuthenticatedRoute(result?.user);
        return;
      }
      setShowOtp(true);
    } catch (err) {
      window.localStorage.removeItem(PENDING_REGISTER_PROFESSION_KEY);
      setError(err.message || "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await backend.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        backend.auth.setToken(result.access_token);
      }
      window.location.href = getDefaultAuthenticatedRoute(result?.user);
    } catch (err) {
      setError(err.message || "Código de verificação inválido.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await backend.auth.resendOtp(email);
      toast({
        title: "Código enviado",
        description: "Verifique seu e-mail para acessar o novo código.",
      });
    } catch (err) {
      setError(err.message || "Não foi possível reenviar o código.");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout
        headingId="verify-heading"
        title="Verifique seu e-mail"
        subtitle={`Enviamos um código de verificação de 6 dígitos para ${email}.`}
        error={error}
        afterContent={
          <div className="pt-2 text-center text-xs font-medium text-[#64748B]">
            Não recebeu o código?{" "}
            <button
              type="button"
              onClick={handleResend}
              className="font-bold text-[#009E86] hover:text-[#007D6A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8] rounded"
            >
              Reenviar código
            </button>
          </div>
        }
      >
        <div className="flex justify-center py-2 mb-5">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          type="button"
          className="h-[52px] w-full rounded-[12px] border-0 bg-[#00d8b8] px-5 text-[15px] font-extrabold text-[#031923] shadow-[0_8px_20px_rgba(0,216,184,0.28)] transition-colors hover:bg-[#00c4a7] active:bg-[#00b095] disabled:cursor-not-allowed disabled:opacity-65 sm:h-[54px]"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
              <span>Verificando...</span>
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <span>Verificar código</span>
              <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
          )}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      headingId="register-heading"
      title="Crie sua conta"
      subtitle="Cadastre-se para começar seus projetos, elaborar orçamentos e gerenciar suas soluções em energia."
      error={error}
      afterContent={
        <>
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#DCE4EC]" aria-hidden="true" />
            <span className="text-xs font-medium text-[#64748B]">ou</span>
            <span className="h-px flex-1 bg-[#DCE4EC]" aria-hidden="true" />
          </div>

          <Button
            asChild
            variant="outline"
            className="h-[50px] w-full rounded-[12px] border-[#DCE4EC] bg-white text-[14px] font-bold text-[#081827] shadow-none transition-colors hover:border-[#00d8b8]/60 hover:bg-[#00d8b8]/5 hover:text-[#081827] sm:h-[52px]"
          >
            <Link to="/login" className="inline-flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4 text-[#081827]" aria-hidden="true" />
              <span>Já tenho conta · Entrar</span>
            </Link>
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Campo E-mail */}
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
              className="h-11 rounded-xl border-[#DCE4EC] bg-white pl-11 pr-4 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/25"
              required
            />
          </div>
        </div>

        {/* Campo Profissão */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="profession" className="text-[13px] font-bold text-[#101828]">
            Profissão
          </Label>
          <div className="relative">
            <Briefcase
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <select
              id="profession"
              value={profession}
              onChange={(event) => setProfession(event.target.value)}
              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-[#DCE4EC] bg-white pl-11 pr-10 text-sm font-medium text-[#101828] outline-none transition-colors focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/25"
              required
            >
              <option value="">Selecione sua profissão</option>
              {PROFESSIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
          </div>
          <p className="text-[11px] font-medium text-[#64748B]">
            Identifica sua área de atuação técnica no painel geral e nos seus projetos.
          </p>
        </div>

        {/* Campos Senha e Confirmar senha */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 text-left">
            <Label htmlFor="password" className="text-[13px] font-bold text-[#101828]">
              Senha
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border-[#DCE4EC] bg-white pl-10 pr-10 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/25"
                required
              />
              <button
                type="button"
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <Label htmlFor="confirm" className="text-[13px] font-bold text-[#101828]">
              Confirmar senha
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
                className="h-11 rounded-xl border-[#DCE4EC] bg-white pl-10 pr-10 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/25"
                required
              />
              <button
                type="button"
                title={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Checkbox Termos de Uso */}
        <div className="flex items-start gap-2.5 pt-1 text-xs">
          <Checkbox
            id="accept-terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            className="mt-0.5 h-4 w-4 rounded-[4px] border-[#CBD5E1] data-[state=checked]:border-[#00d8b8] data-[state=checked]:bg-[#00d8b8] data-[state=checked]:text-[#031923]"
          />
          <Label
            htmlFor="accept-terms"
            className="cursor-pointer select-none text-xs font-medium leading-relaxed text-[#475569]"
          >
            Li e concordo com os{" "}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#009E86] hover:text-[#007D6A] hover:underline"
            >
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#009E86] hover:text-[#007D6A] hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </Label>
        </div>

        {/* Botão Criar Conta com cor primária oficial #00d8b8 */}
        <div className="pt-1.5">
          <Button
            type="submit"
            disabled={loading}
            className="h-[52px] w-full rounded-[12px] border-0 bg-[#00d8b8] px-5 text-[15px] font-extrabold text-[#031923] shadow-[0_8px_20px_rgba(0,216,184,0.28)] transition-colors hover:bg-[#00c4a7] active:bg-[#00b095] focus-visible:ring-2 focus-visible:ring-[#00d8b8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:h-[54px]"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                <span>Criando conta...</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <span>Criar conta grátis</span>
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
