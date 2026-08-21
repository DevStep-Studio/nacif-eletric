import React, { useState } from "react";
import { Link } from "react-router-dom";
import { backend, isLocalAuthMode } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff, Lock, LogIn, Mail, Loader2, UserRound } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const REMEMBER_EMAIL_KEY = "voltai_remembered_login_email";
const LOCAL_USERS_KEY = "voltai_local_users";
const DEMO_EMAIL = "demo@nacifsolutions.com.br";
const DEMO_PASSWORD = "demo1234";

const readRememberedEmail = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
};

const ensureDemoUser = () => {
  if (!isLocalAuthMode || typeof window === "undefined") return;

  const now = new Date().toISOString();
  let users = [];
  try {
    users = JSON.parse(window.localStorage.getItem(LOCAL_USERS_KEY) || "[]");
  } catch {
    users = [];
  }

  const safeUsers = Array.isArray(users) ? users : [];
  const demoIndex = safeUsers.findIndex((user) => user?.email === DEMO_EMAIL);
  const demoUser = {
    id: "local_user_demo",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    full_name: "Demonstração NACIF",
    profession: "projetista",
    profissao: "projetista",
    role: safeUsers.length === 0 ? "admin" : "user",
    plan: "profissional",
    created_date: safeUsers[demoIndex]?.created_date || now,
    updated_date: now,
  };

  const nextUsers = demoIndex >= 0
    ? safeUsers.map((user, index) => index === demoIndex ? { ...user, ...demoUser, id: user.id || demoUser.id } : user)
    : [...safeUsers, demoUser];

  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(nextUsers));
};

export default function Login() {
  const [email, setEmail] = useState(readRememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => Boolean(readRememberedEmail()));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await backend.auth.loginViaEmailPassword(email, password);
      if (isLocalAuthMode && result?.access_token) {
        backend.auth.setToken(result.access_token);
      }
      if (typeof window !== "undefined") {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Email ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    ensureDemoUser();
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setRememberMe(true);
    setError("");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, DEMO_EMAIL);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Bem-vindo de volta"
      subtitle="Entre na sua conta para acessar seus projetos, relatórios e memoriais."
    >
      {error && (
        <div className="mb-5 rounded-[8px] border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-extrabold text-slate-900">
            E-mail *
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-[8px] border-slate-200 bg-white pl-10 text-sm font-medium shadow-none placeholder:text-slate-400 focus-visible:ring-primary/30"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-extrabold text-slate-900">
            Senha *
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-[8px] border-slate-200 bg-white pl-10 pr-10 text-sm font-medium shadow-none placeholder:text-slate-400 focus-visible:ring-primary/30"
              required
            />
            <button
              type="button"
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="h-4 w-4 rounded-[4px] border-slate-300"
            />
            Lembrar de mim
          </label>
          <Link to="/forgot-password" className="text-xs font-extrabold text-primary transition hover:brightness-90">
            Esqueci a senha
          </Link>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-[8px] text-sm font-extrabold shadow-[0_12px_24px_rgba(0,216,184,0.22)]"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              Entrar na conta
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs font-medium text-slate-400">
        Não tem conta?{" "}
        <Link to="/register" className="font-extrabold text-primary transition hover:brightness-90">
          Criar conta grátis
        </Link>
      </p>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-100" />
        </div>
        <div className="relative flex justify-center text-[11px] font-bold uppercase text-slate-300">
          <span className="bg-white px-3">ou</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleDemoFill}
        className="h-11 w-full rounded-[8px] border-slate-200 bg-white text-xs font-extrabold text-slate-600 shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      >
        <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
        Preencher Dados de Demonstração
      </Button>
    </AuthLayout>
  );
}
