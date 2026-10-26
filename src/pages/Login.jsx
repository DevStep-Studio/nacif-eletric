import React, { useState } from "react";
import { Link } from "react-router-dom";
import { backend, isLocalAuthMode } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import authLogoEnergy from "@/assets/brand-logo-principal.png";
import { useBranding } from "@/lib/appPreferences";
import FlutedGlassArtwork from "@/components/login/FlutedGlassArtwork";

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

  const { branding } = useBranding();
  const isDefaultLogo =
    !branding?.authLogoDataUrl ||
    branding.authLogoDataUrl === "/brand-logo-principal.png" ||
    branding.authLogoDataUrl.includes("brand-logo-principal") ||
    branding.authLogoDataUrl.includes("Logo-Principal") ||
    branding.authLogoDataUrl.includes("nacif");
  const authLogo = isDefaultLogo ? authLogoEnergy : (branding.authLogoDataUrl || authLogoEnergy);
  const brandName = [branding?.appName, branding?.appSuffix].filter(Boolean).join(" ") || "NACIF Energy";
  const currentYear = new Date().getFullYear();

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
    <div className="min-h-screen bg-[#FAFCFC] text-slate-900 flex flex-col justify-between selection:bg-[#00d8b8]/20 selection:text-slate-950">
      {/* Container Principal de 2 Colunas */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8 xl:px-12">
        <div className="w-full max-w-[1020px] mx-auto grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] xl:grid-cols-[1.18fr_0.82fr] gap-8 lg:gap-14 xl:gap-20 items-center">
          
          {/* ─────────────────────────────────────────────────────────────
              PAINEL ESQUERDO (Desktop): 
              Proporção ~4:5, cantos arredondados (24px), arte de vidro canelado 
              e tipografia refinada com a palavra 'sol' em itálico editorial
             ───────────────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex relative flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200/80 bg-[#F8FBFB] shadow-[0_20px_50px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] w-full max-w-[490px] h-[640px] xl:h-[660px] p-8 xl:p-9 mx-auto">
            
            {/* Topo: Logo oficial da marca no canto superior esquerdo */}
            <header className="relative z-10 flex items-center">
              <img
                src={authLogo}
                alt={brandName}
                className="h-8 max-w-[160px] object-contain object-left"
                onError={(e) => {
                  if (e.currentTarget.src !== authLogoEnergy) {
                    e.currentTarget.src = authLogoEnergy;
                  }
                }}
              />
            </header>

            {/* Arte abstrata: lâminas de vidro canelado com luz e acentos #00d8b8 */}
            <div className="absolute inset-x-0 top-0 pt-10 pointer-events-none">
              <FlutedGlassArtwork />
            </div>

            {/* Conteúdo inferior do painel: Respiro, contraste e tipografia editorial */}
            <footer className="relative z-10 pt-8">
              {/* Linha introdutória com ponto indicador na cor da marca */}
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#00d8b8] shadow-[0_0_8px_rgba(0,216,184,0.9)]" />
                <span className="text-xs font-semibold tracking-wide text-slate-600">
                  Seu próximo projeto começa aqui
                </span>
              </div>

              {/* Título com destaque tipográfico na palavra 'sol' */}
              <h2 className="text-[31px] xl:text-[34px] font-extrabold leading-[1.18] tracking-tight text-slate-900 mb-3.5">
                Da planta ao{" "}
                <span className="font-editorial text-[1.26em] font-normal italic text-slate-950 inline-block px-1 transform -translate-y-0.5">
                  sol
                </span>
                ,<br />
                tudo em um só lugar.
              </h2>

              {/* Descrição curta e legível */}
              <p className="text-[13px] leading-relaxed text-slate-500 font-normal max-w-[390px]">
                Planeje instalações elétricas, monte quadros e desenvolva projetos solares em uma única plataforma.
              </p>
            </footer>
          </aside>

          {/* ─────────────────────────────────────────────────────────────
              COLUNA DIREITA: Formulário Compacto sem Card Externo
             ───────────────────────────────────────────────────────────── */}
          <section className="w-full max-w-[350px] mx-auto flex flex-col justify-center">
            
            {/* Versão compacta para Mobile (< lg): Logo e Banner sutil sem rolagem excessiva */}
            <div className="lg:hidden mb-6 flex flex-col items-center text-center">
              <img
                src={authLogo}
                alt={brandName}
                className="h-8 max-w-[150px] object-contain mb-4"
                onError={(e) => {
                  if (e.currentTarget.src !== authLogoEnergy) {
                    e.currentTarget.src = authLogoEnergy;
                  }
                }}
              />
              
              <div className="w-full relative overflow-hidden rounded-[16px] border border-slate-200/80 bg-[#F8FBFB] p-4 text-left shadow-sm">
                <div className="inline-flex items-center gap-2 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00d8b8]" />
                  <span className="text-[11px] font-semibold text-slate-600">
                    Seu próximo projeto começa aqui
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-900 leading-snug">
                  Da planta ao <span className="font-editorial italic font-normal text-base">sol</span>, tudo em um só lugar.
                </p>
              </div>
            </div>

            {/* Cabeçalho do Formulário (Centralizado como na referência) */}
            <div className="mb-7 text-center">
              <h1 className="text-[25px] sm:text-[27px] font-extrabold tracking-tight text-slate-900">
                Acesse sua conta
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm font-normal text-slate-500">
                Entre para continuar seus projetos.
              </p>
            </div>

            {/* Mensagem de Erro com alta legibilidade */}
            {error && (
              <div 
                role="alert" 
                className="mb-5 rounded-[8px] border border-red-200/80 bg-red-50 p-3 text-xs font-semibold text-red-600 animate-in fade-in"
              >
                {error}
              </div>
            )}

            {/* Formulário com campos limpos e foco na cor primária #00d8b8 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Campo E-mail */}
              <div className="space-y-1.5 text-left">
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
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5 text-left">
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
              </div>

              {/* Opção Lembrar de mim */}
              <div className="flex items-center gap-2 pt-0.5">
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
              </div>

              {/* Botão Principal com a cor #00d8b8 e texto escuro de alto contraste */}
              <div className="pt-2">
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
              </div>
            </form>

            {/* Link para Cadastro Gratuito */}
            <p className="mt-6 text-center text-xs font-normal text-slate-500">
              Não tem conta?{" "}
              <Link 
                to="/register" 
                className="font-semibold text-slate-900 hover:text-[#00a98e] underline underline-offset-4 transition-colors"
              >
                Criar conta grátis
              </Link>
            </p>
          </section>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          RODAPÉ DISCRETO: Centralizado abaixo da composição
         ───────────────────────────────────────────────────────────── */}
      <footer className="mt-auto py-6 text-center text-[11px] font-normal text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>© {currentYear} {brandName}</span>
          <span className="text-slate-300">•</span>
          <a href="/privacidade" className="hover:text-slate-600 transition-colors">
            Privacidade
          </a>
          <span className="text-slate-300">•</span>
          <a href="/termos" className="hover:text-slate-600 transition-colors">
            Termos
          </a>
        </div>
      </footer>
    </div>
  );
}
