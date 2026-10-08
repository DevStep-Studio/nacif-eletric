import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Zap, ShieldCheck } from "lucide-react";
import { useBranding } from "@/lib/appPreferences";
import { Button } from "@/components/ui/button";
import PublicFooter from "./PublicFooter";

export default function SystemPageLayout({
  title,
  subtitle,
  badge,
  icon: Icon,
  showBackButton = true,
  backTo = null,
  actions = null,
  maxWidth = "max-w-5xl",
  children,
  showFooter = true,
  showHeader = true,
}) {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const brandName = [branding.appName, branding.appSuffix].filter(Boolean).join(" ") || "Nacif Electric";

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] font-inter">
      {/* Top Navbar */}
      {showHeader && (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white/95 px-4 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00d8b8] text-white font-black shadow-sm">
                <Zap className="h-4 w-4 fill-current" />
              </div>
              <span className="font-extrabold text-sm sm:text-base text-[#0F172A] tracking-tight">
                {brandName}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Button asChild variant="ghost" size="sm" className="text-xs font-bold text-[#64748B] hover:text-[#0F172A]">
              <Link to="/ajuda">Ajuda</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs font-bold text-[#64748B] hover:text-[#0F172A]">
              <Link to="/contato">Contato</Link>
            </Button>
            <Button asChild size="sm" className="h-9 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold">
              <Link to="/">
                <Home className="h-3.5 w-3.5 mr-1.5" />
                Ir para o Início
              </Link>
            </Button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <div className={`mx-auto w-full ${maxWidth} px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8`}>
          {/* Header section if provided */}
          {(title || showBackButton) && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-start gap-3.5">
                {showBackButton && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition"
                    title="Voltar"
                    aria-label="Voltar para página anterior"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="space-y-1">
                  {badge && (
                    <div className="inline-block rounded-md bg-[#E8FCF8] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0f4f49]">
                      {badge}
                    </div>
                  )}
                  {title && (
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] flex items-center gap-2">
                      {Icon && <Icon className="h-6 w-6 text-[#00d8b8]" />}
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-xs sm:text-sm font-medium text-[#64748B] max-w-2xl">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {actions && (
                <div className="flex items-center gap-2 shrink-0">
                  {actions}
                </div>
              )}
            </div>
          )}

          {/* Children body */}
          <div className="min-w-0">
            {children}
          </div>
        </div>
      </main>

      {/* Public Footer */}
      {showFooter && <PublicFooter />}
    </div>
  );
}
