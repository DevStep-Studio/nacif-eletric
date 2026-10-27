import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { backend, isLocalAuthMode } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const REMEMBER_EMAIL_KEY = "voltai_remembered_login_email";

const readRememberedEmail = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
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

  return (
    <AuthLayout
      title="Acesse sua conta"
      subtitle="Entre para continuar seus projetos."
      footer={
        <p className="text-center text-xs text-slate-500">
          Não tem conta?{" "}
          <Link 
            to="/register" 
            className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors"
          >
            Criar conta grátis
          </Link>
        </p>
      }
    >
      {/* Mensagem de Erro com alta legibilidade */}
      {error && (
        <div 
          role="alert" 
          className="mb-5 rounded-[8px] border border-red-200/80 bg-red-50 p-3 text-xs font-semibold text-red-600 animate-in fade-in"
        >
          {error}
        </div>
      )}

      {/* Formulário com campos limpos e animação staggered com foco na cor primária #00d8b8 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Campo E-mail */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-1.5 text-left"
        >
          <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
            E-mail
          </Label>
          <div className="relative">
            <Mail 
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" 
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
              className="h-[48px] rounded-[8px] border-slate-200 bg-slate-50/90 pl-10 pr-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#00d8b8] focus-visible:ring-2 focus-visible:ring-[#00d8b8]/20 transition-all outline-none shadow-none"
              required
            />
          </div>
        </motion.div>

        {/* Campo Senha */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-1.5 text-left"
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
              Senha
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <div className="relative">
            <Lock 
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" 
              aria-hidden="true" 
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </motion.div>

        {/* Opção Lembrar de mim */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 pt-0.5"
        >
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
            className="h-4 w-4 rounded-[4px] border-slate-300 data-[state=checked]:bg-[#00d8b8] data-[state=checked]:border-[#00d8b8] data-[state=checked]:text-slate-950"
          />
          <label 
            htmlFor="remember" 
            className="text-xs font-normal text-slate-500 cursor-pointer select-none"
          >
            Lembrar de mim
          </label>
        </motion.div>

        {/* Botão Principal com a cor #00d8b8 e animação de feedback ao toque */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.985 }}
          className="pt-2"
        >
          <Button
            type="submit"
            disabled={loading}
            className="h-[48px] w-full rounded-[8px] bg-[#00d8b8] hover:bg-[#00c5a7] active:bg-[#00b397] text-slate-950 font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(0,216,184,0.25)] hover:shadow-[0_6px_20px_rgba(0,216,184,0.35)] transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Entrando...</span>
              </span>
            ) : (
              "Entrar"
            )}
          </Button>
        </motion.div>
      </form>
    </AuthLayout>
  );
}
