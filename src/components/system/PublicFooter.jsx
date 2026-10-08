import { Link } from "react-router-dom";
import { Zap, Shield, HelpCircle, FileText, CheckCircle2 } from "lucide-react";
import { useBranding } from "@/lib/appPreferences";

export default function PublicFooter({ className = "" }) {
  const { branding } = useBranding();
  const currentYear = new Date().getFullYear();
  const brandName = [branding.appName, branding.appSuffix].filter(Boolean).join(" ") || "Nacif Electric";

  return (
    <footer className={`border-t border-[#E2E8F0] bg-white text-[#64748B] text-xs ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#F1F5F9]">
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00d8b8] text-white font-black">
                <Zap className="h-4 w-4 fill-current" />
              </div>
              <span className="font-extrabold text-sm text-[#0F172A]">{brandName}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#64748B]">
              Plataforma de engenharia elétrica para projetos em conformidade com a NBR 5410, diagramas unifilares e dimensionamento solar.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-[#0f4f49] font-bold">
              <span className="flex h-2 w-2 rounded-full bg-[#00d8b8]" />
              <Link to="/status" className="hover:underline">
                Sistemas 100% Operacionais
              </Link>
            </div>
          </div>

          {/* Links: Produto */}
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-wider text-[#0F172A] mb-3">
              Produto & Recursos
            </h2>
            <ul className="space-y-2 text-[12px] font-medium">
              <li>
                <Link to="/planta-ia" className="hover:text-[#00d8b8] transition-colors">
                  Editor de Planta Elétrica
                </Link>
              </li>
              <li>
                <Link to="/panel-generator" className="hover:text-[#00d8b8] transition-colors">
                  Quadro de Distribuição
                </Link>
              </li>
              <li>
                <Link to="/unifilar" className="hover:text-[#00d8b8] transition-colors">
                  Diagrama Unifilar
                </Link>
              </li>
              <li>
                <Link to="/calculator" className="hover:text-[#00d8b8] transition-colors">
                  Calculadoras NBR 5410
                </Link>
              </li>
              <li>
                <Link to="/novidades" className="hover:text-[#00d8b8] transition-colors">
                  Changelog & Novidades
                </Link>
              </li>
            </ul>
          </div>

          {/* Links: Suporte & Institucional */}
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-wider text-[#0F172A] mb-3">
              Suporte & Ajuda
            </h2>
            <ul className="space-y-2 text-[12px] font-medium">
              <li>
                <Link to="/ajuda" className="hover:text-[#00d8b8] transition-colors">
                  Central de Ajuda
                </Link>
              </li>
              <li>
                <Link to="/suporte" className="hover:text-[#00d8b8] transition-colors">
                  Falar com Suporte
                </Link>
              </li>
              <li>
                <Link to="/contato" className="hover:text-[#00d8b8] transition-colors">
                  Fale Conosco
                </Link>
              </li>
              <li>
                <Link to="/status" className="hover:text-[#00d8b8] transition-colors">
                  Status do Sistema
                </Link>
              </li>
              <li>
                <Link to="/sobre" className="hover:text-[#00d8b8] transition-colors">
                  Sobre a Empresa
                </Link>
              </li>
            </ul>
          </div>

          {/* Links: Legal & Privacidade */}
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-wider text-[#0F172A] mb-3">
              Legal & Privacidade
            </h2>
            <ul className="space-y-2 text-[12px] font-medium">
              <li>
                <Link to="/termos" className="hover:text-[#00d8b8] transition-colors">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="hover:text-[#00d8b8] transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-[#00d8b8] transition-colors">
                  Política de Cookies
                </Link>
              </li>
              <li>
                <Link to="/seguranca" className="hover:text-[#00d8b8] transition-colors">
                  Segurança & Proteção
                </Link>
              </li>
              <li>
                <Link to="/privacidade/direitos" className="hover:text-[#00d8b8] transition-colors">
                  Direitos do Titular (LGPD)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p className="text-[#94A3B8]">
            © {currentYear} {brandName}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/termos" className="hover:text-[#0F172A] transition">
              Termos
            </Link>
            <Link to="/privacidade" className="hover:text-[#0F172A] transition">
              Privacidade
            </Link>
            <Link to="/cookies" className="hover:text-[#0F172A] transition">
              Cookies
            </Link>
            <Link to="/seguranca" className="hover:text-[#0F172A] transition">
              Segurança
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
