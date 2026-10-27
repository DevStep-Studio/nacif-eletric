import React, { useState } from "react";
import { Link } from "react-router-dom";
import { backend, isLocalAuthMode } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { PENDING_REGISTER_PROFESSION_KEY, PROFESSIONS, normalizeProfession } from "@/lib/professionalAccess";

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
      setError("Você deve ler e concordar com os Termos de Uso e a Política de Privacidade para criar uma conta.");
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
      if (isLocalAuthMode) {
        if (result?.access_token) {
          backend.auth.setToken(result.access_token);
        }
        window.localStorage.removeItem(PENDING_REGISTER_PROFESSION_KEY);
        window.location.href = "/";
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
      window.location.href = "/";
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
        description: "Verifique seu email para acessar o novo código.",
      });
    } catch (err) {
      setError(err.message || "Não foi possível reenviar o código.");
    }
  };

  const handleGoogle = () => {
    if (isLocalAuthMode) {
      setError("Login com Google não está habilitado neste backend.");
      return;
    }

    const normalizedProfession = normalizeProfession(profession);
    if (!normalizedProfession) {
      setError("Selecione sua profissão antes de continuar com Google.");
      return;
    }

    window.localStorage.setItem(PENDING_REGISTER_PROFESSION_KEY, normalizedProfession);
    backend.auth.loginWithProvider("google", "/");
  };

  if (showOtp) {
    return (
      <AuthLayout
        title="Verifique seu email"
        subtitle={`Enviamos um código de verificação para ${email}`}
        footer={
          <p className="text-center text-xs text-slate-500">
            Não recebeu o código?{" "}
            <button 
              type="button"
              onClick={handleResend} 
              className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors"
            >
              Reenviar
            </button>
          </p>
        }
      >
        {error && (
          <div role="alert" className="mb-5 rounded-[8px] border border-red-200/80 bg-red-50 p-3 text-xs font-semibold text-red-600 animate-in fade-in">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
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
          className="h-[48px] w-full rounded-[8px] bg-[#00d8b8] hover:bg-[#00c5a7] active:bg-[#00b397] text-slate-950 font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(0,216,184,0.25)] hover:shadow-[0_6px_20px_rgba(0,216,184,0.35)] transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              <span>Verificando...</span>
            </span>
          ) : (
            "Verificar código"
          )}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Cadastre-se para começar seus projetos."
      footer={
        <p className="text-center text-xs text-slate-500">
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors">
            Entrar
          </Link>
        </p>
      }
    >
      {!isLocalAuthMode && (
        <>
          <Button
            variant="outline"
            className="w-full h-[48px] rounded-[8px] border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 mb-5 shadow-none"
            onClick={handleGoogle}
          >
            <GoogleIcon className="w-4 h-4 mr-2" />
            Continuar com Google
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#FAFCFC] px-3 text-slate-400 font-medium">ou</span>
            </div>
          </div>
        </>
      )}

      {error && (
        <div role="alert" className="mb-5 rounded-[8px] border border-red-200/80 bg-red-50 p-3 text-xs font-semibold text-red-600 animate-in fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo E-mail */}
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

        {/* Campo Profissão */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="profession" className="text-xs font-semibold text-slate-700">
            Profissão
          </Label>
          <select
            id="profession"
            value={profession}
            onChange={(event) => setProfession(event.target.value)}
            className="h-[48px] w-full rounded-[8px] border border-slate-200 bg-slate-50/90 px-3.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/20 transition-all outline-none shadow-none cursor-pointer"
            required
          >
            <option value="">Selecione sua profissão</option>
            {PROFESSIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] font-normal text-slate-500">
            Arquiteto acessa a Planta IA. Projetista e eletricista acessam todos os módulos.
          </p>
        </div>

        {/* Campo Senha */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
            Senha
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        {/* Campo Confirmar Senha */}
        <div className="space-y-1.5 text-left">
          <Label htmlFor="confirm" className="text-xs font-semibold text-slate-700">
            Confirmar senha
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

        {/* Checkbox Termos de Uso */}
        <div className="flex items-start gap-2.5 pt-1 text-xs">
          <input
            id="accept-terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-[#00d8b8] cursor-pointer accent-[#00d8b8]"
            required
          />
          <Label htmlFor="accept-terms" className="text-xs font-normal text-slate-500 leading-relaxed cursor-pointer select-none">
            Li e concordo com os{" "}
            <Link to="/termos" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors">
              Política de Privacidade
            </Link>
            .
          </Label>
        </div>

        {/* Botão Criar Conta */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="h-[48px] w-full rounded-[8px] bg-[#00d8b8] hover:bg-[#00c5a7] active:bg-[#00b397] text-slate-950 font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(0,216,184,0.25)] hover:shadow-[0_6px_20px_rgba(0,216,184,0.35)] transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Criando conta...</span>
              </span>
            ) : (
              "Criar conta"
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
