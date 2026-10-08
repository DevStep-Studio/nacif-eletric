import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Printer,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useBranding } from "@/lib/appPreferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PublicFooter from "./PublicFooter";

export default function LegalPageLayout({
  title,
  subtitle,
  version = "1.0",
  lastUpdated = "02 de Outubro de 2026",
  sections = [], // Array of { id: string, title: string }
  children,
}) {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const brandName = [branding.appName, branding.appSuffix].filter(Boolean).join(" ") || "Nacif Electric";
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((s) => s.title.toLowerCase().includes(q));
  }, [sections, searchQuery]);

  const scrollToSection = (id) => {
    setActiveSection(id);
    setMobileTocOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90; // offset for sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] font-inter">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white/95 px-4 sm:px-8 backdrop-blur-md print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00d8b8] text-white font-black shadow-sm">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <span className="font-extrabold text-sm sm:text-base text-[#0F172A] tracking-tight">
              {brandName}
            </span>
          </Link>
          <span className="text-[#CBD5E1]">/</span>
          <span className="text-xs font-bold text-[#64748B]">Central Legal & Privacidade</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 rounded-lg text-xs font-bold text-[#64748B] hover:text-[#0F172A]"
            title="Imprimir documento"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
          </Button>
          <Button asChild size="sm" className="h-8 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold">
            <Link to="/">Voltar ao Início</Link>
          </Button>
        </div>
      </header>

      {/* Hero Header */}
      <div className="border-b border-[#E2E8F0] bg-white py-8 sm:py-12 px-4 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#64748B] mb-3">
            <Link to="/" className="hover:text-[#00d8b8] transition">Início</Link>
            <ChevronRight className="h-3 w-3 text-[#CBD5E1]" />
            <Link to="/privacidade" className="hover:text-[#00d8b8] transition">Legal</Link>
            <ChevronRight className="h-3 w-3 text-[#CBD5E1]" />
            <span className="text-[#0F172A]">{title}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-[#E8FCF8] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0f4f49]">
                  Documento Oficial
                </span>
                <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">
                  Versão {version}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[#0F172A]">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm font-medium text-[#64748B] max-w-2xl">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-[#64748B] bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] self-start md:self-auto">
              <Calendar className="h-4 w-4 text-[#00d8b8]" />
              <div>
                <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Última atualização</p>
                <p className="text-[#0F172A] font-bold">{lastUpdated}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body with Sidebar */}
      <div className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-8 py-8 sm:py-12">
        {/* Mobile TOC Drawer/Accordion */}
        {sections.length > 0 && (
          <div className="mb-6 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTocOpen(!mobileTocOpen)}
              className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-3 text-xs font-bold text-[#0F172A] shadow-sm"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#00d8b8]" />
                <span>Sumário do Documento ({sections.length} seções)</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`} />
            </button>

            {mobileTocOpen && (
              <div className="mt-2 rounded-xl border border-[#E2E8F0] bg-white p-3 space-y-1 shadow-sm">
                {sections.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  >
                    <span className="font-bold text-[#94A3B8] text-[10px]">{idx + 1}.</span>
                    <span className="truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-10">
          {/* Desktop Sticky Sidebar TOC */}
          {sections.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
                    <Input
                      type="text"
                      placeholder="Filtrar seções..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs rounded-lg border-[#E2E8F0]"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 space-y-1 shadow-sm">
                  <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#94A3B8]">
                    Sumário
                  </p>
                  <nav className="max-h-[60vh] overflow-y-auto space-y-0.5 pr-1">
                    {filteredSections.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => scrollToSection(s.id)}
                        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                          activeSection === s.id
                            ? "bg-[#E8FCF8] font-bold text-[#0f4f49]"
                            : "font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-[#94A3B8] mt-0.5">{idx + 1}.</span>
                        <span className="leading-snug">{s.title}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Quick links to other legal docs */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2 text-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#94A3B8]">
                    Outros Documentos
                  </p>
                  <ul className="space-y-1.5 font-bold text-[#64748B]">
                    <li><Link to="/termos" className="hover:text-[#00d8b8] transition">Termos de Uso</Link></li>
                    <li><Link to="/privacidade" className="hover:text-[#00d8b8] transition">Política de Privacidade</Link></li>
                    <li><Link to="/cookies" className="hover:text-[#00d8b8] transition">Política de Cookies</Link></li>
                    <li><Link to="/seguranca" className="hover:text-[#00d8b8] transition">Segurança</Link></li>
                    <li><Link to="/privacidade/direitos" className="hover:text-[#00d8b8] transition">Direitos LGPD</Link></li>
                  </ul>
                </div>
              </div>
            </aside>
          )}

          {/* Reading Content Area */}
          <article className="min-w-0 max-w-3xl space-y-8 text-sm leading-relaxed text-[#334155]">
            {children}
          </article>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
