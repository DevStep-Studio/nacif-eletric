import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  UserPlus,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import { getDefaultAuthenticatedRoute } from "@/lib/professionalAccess";

const REMEMBER_EMAIL_KEY = "voltai_remembered_login_email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readRememberedEmail = () => {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
  } catch {
    return "";
  }
};

export default function Login() {
  const [email, setEmail] = useState(readRememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => Boolean(readRememberedEmail()));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const validateFields = () => {
    const trimmedEmail = email.trim();
    const nextErrors = { email: "", password: "" };

    if (!trimmedEmail) {
      nextErrors.email = "Informe seu e-mail.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Informe um endereço de e-mail válido.";
    }

    if (!password) {
      nextErrors.password = "Informe sua senha.";
    }

    setFieldErrors(nextErrors);
    return !nextErrors.email && !nextErrors.password;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateFields()) {
      return;
    }

    const normalizedEmail = email.trim();
    setLoading(true);
    try {
      const result = await backend.auth.loginViaEmailPassword(
        normalizedEmail,
        password
      );
      if (result?.access_token) {
        backend.auth.setToken(result.access_token);
      }
      if (typeof window !== "undefined") {
        try {
          if (rememberMe) {
            window.localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
          } else {
            window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
          }
        } catch {
          // Storage indisponível não deve impedir autenticação concluída
        }
      }
      window.location.href = getDefaultAuthenticatedRoute(result?.user);
    } catch (err) {
      setError(err?.message || "E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headingId="login-heading"
      title="Acesse sua conta"
      subtitle="Entre para continuar seus projetos, acompanhar orçamentos e gerenciar suas soluções em energia."
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
            <Link to="/register" className="inline-flex items-center justify-center gap-2">
              <UserPlus className="h-[18px] w-[18px] text-[#081827]" aria-hidden="true" />
              <span>Criar conta grátis</span>
            </Link>
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className={`h-12 rounded-xl border bg-white pl-11 pr-4 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:ring-2 ${
                fieldErrors.email
                  ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200"
                  : "border-[#DCE4EC] focus-visible:border-[#00d8b8] focus-visible:ring-[#00d8b8]/25"
              }`}
              required
            />
          </div>
          {fieldErrors.email && (
            <p id="email-error" className="text-xs font-semibold text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Campo Senha */}
        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password" className="text-[13px] font-bold text-[#101828]">
              Senha
            </Label>
            <Link
              to="/forgot-password"
              className="rounded text-[13px] font-bold text-[#009E86] transition-colors hover:text-[#007D6A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className={`h-12 rounded-xl border bg-white pl-11 pr-11 text-sm font-medium text-[#101828] placeholder:text-[#94A3B8] shadow-none transition-colors focus-visible:ring-2 ${
                fieldErrors.password
                  ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200"
                  : "border-[#DCE4EC] focus-visible:border-[#00d8b8] focus-visible:ring-[#00d8b8]/25"
              }`}
              required
            />
            <button
              type="button"
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8]"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
              ) : (
                <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-xs font-semibold text-red-600">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Checkbox Lembrar de mim */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
            className="h-4 w-4 rounded-[4px] border-[#CBD5E1] data-[state=checked]:border-[#00d8b8] data-[state=checked]:bg-[#00d8b8] data-[state=checked]:text-[#031923]"
          />
          <label
            htmlFor="remember"
            className="cursor-pointer select-none text-[13px] font-medium text-[#475569]"
          >
            Lembrar de mim
          </label>
        </div>

        {/* Botão Principal Entrar com cor primária oficial #00d8b8 */}
        <div className="pt-1.5">
          <Button
            type="submit"
            disabled={loading}
            className="h-[54px] w-full rounded-[12px] border-0 bg-[#00d8b8] px-5 text-[15px] font-extrabold text-[#031923] shadow-[0_8px_20px_rgba(0,216,184,0.28)] transition-colors hover:bg-[#00c4a7] active:bg-[#00b095] focus-visible:ring-2 focus-visible:ring-[#00d8b8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:h-[56px]"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                <span>Entrando...</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <span>Entrar</span>
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
