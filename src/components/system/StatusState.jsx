import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Home,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  WifiOff,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StatusState({
  status = "404", // "404" | "403" | "401" | "500" | "503" | "offline" | "maintenance" | "payment-success" | "payment-failed" | "payment-pending" | "limit-reached"
  code = null,
  title,
  description,
  errorId = null,
  primaryAction = null,
  secondaryAction = null,
  auxiliaryLinks = null,
  icon: CustomIcon = null,
  className = "",
}) {
  const navigate = useNavigate();

  // Preset configuration based on status
  const config = (() => {
    switch (status) {
      case "404":
        return {
          code: code || "404",
          icon: CustomIcon || Search,
          iconBg: "bg-slate-100 text-slate-700",
          title: title || "Página não encontrada",
          description: description || "Não encontramos o endereço que você tentou acessar. O link pode estar incorreto ou a página foi movida.",
          defaultPrimary: { label: "Ir para o Início", to: "/" },
          defaultSecondary: { label: "Voltar", onClick: () => navigate(-1) },
        };
      case "403":
        return {
          code: code || "403",
          icon: CustomIcon || Lock,
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200",
          title: title || "Acesso restrito",
          description: description || "Você não possui permissão para acessar esta área ou recurso do sistema.",
          defaultPrimary: { label: "Ir para o Início", to: "/" },
          defaultSecondary: { label: "Voltar", onClick: () => navigate(-1) },
        };
      case "401":
        return {
          code: code || "401",
          icon: CustomIcon || ShieldAlert,
          iconBg: "bg-blue-50 text-blue-600 border border-blue-200",
          title: title || "Sessão expirada",
          description: description || "Sua sessão terminou por segurança ou você precisa estar autenticado para continuar.",
          defaultPrimary: { label: "Entrar novamente", to: "/login" },
          defaultSecondary: { label: "Ir para o Início", to: "/" },
        };
      case "500":
        return {
          code: code || "500",
          icon: CustomIcon || AlertCircle,
          iconBg: "bg-red-50 text-red-600 border border-red-200",
          title: title || "Algo não saiu como esperado",
          description: description || "Ocorreu um erro ao processar sua solicitação. Nossa equipe de engenharia foi notificada automaticamente.",
          defaultPrimary: { label: "Tentar novamente", onClick: () => window.location.reload() },
          defaultSecondary: { label: "Ir para o Início", to: "/" },
        };
      case "503":
      case "502":
        return {
          code: code || "503",
          icon: CustomIcon || Wrench,
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200",
          title: title || "Serviço temporariamente indisponível",
          description: description || "Estamos realizando uma breve manutenção ou o serviço está temporariamente sobrecarregado. Voltaremos em instantes.",
          defaultPrimary: { label: "Tentar novamente", onClick: () => window.location.reload() },
          defaultSecondary: { label: "Ver status do sistema", to: "/status" },
        };
      case "offline":
        return {
          code: code || "OFFLINE",
          icon: CustomIcon || WifiOff,
          iconBg: "bg-slate-100 text-slate-700 border border-slate-200",
          title: title || "Sem conexão com a internet",
          description: description || "Verifique sua conexão de rede e tente novamente. Seus dados em edição local permanecem seguros.",
          defaultPrimary: { label: "Tentar reconectar", onClick: () => window.location.reload() },
          defaultSecondary: { label: "Ir para o Início", to: "/" },
        };
      case "maintenance":
        return {
          code: code || "MANUTENÇÃO",
          icon: CustomIcon || Wrench,
          iconBg: "bg-[#E8FCF8] text-[#0f4f49] border border-[#CDEFE8]",
          title: title || "Estamos fazendo melhorias no sistema",
          description: description || "Estamos atualizando nossos motores de cálculo e infraestrutura. O sistema estará disponível em breve.",
          defaultPrimary: { label: "Atualizar página", onClick: () => window.location.reload() },
          defaultSecondary: { label: "Ver status", to: "/status" },
        };
      case "payment-success":
        return {
          code: code || "APROVADO",
          icon: CustomIcon || CheckCircle2,
          iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200",
          title: title || "Pagamento confirmado",
          description: description || "Seu plano foi ativado com sucesso! Todos os recursos profissionais já estão liberados para a sua conta.",
          defaultPrimary: { label: "Continuar para o Dashboard", to: "/" },
          defaultSecondary: { label: "Ver detalhes do plano", to: "/subscription" },
        };
      case "payment-failed":
        return {
          code: code || "FALHA",
          icon: CustomIcon || CreditCard,
          iconBg: "bg-red-50 text-red-600 border border-red-200",
          title: title || "Não foi possível concluir o pagamento",
          description: description || "Houve uma recusa por parte da operadora ou emissor do cartão. Nenhuma cobrança foi efetuada.",
          defaultPrimary: { label: "Tentar novamente", to: "/subscription" },
          defaultSecondary: { label: "Falar com suporte", to: "/suporte" },
        };
      case "payment-pending":
        return {
          code: code || "PROCESSANDO",
          icon: CustomIcon || Clock,
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200",
          title: title || "Pagamento em processamento",
          description: description || "Assim que recebermos a confirmação da instituição bancária ou compensação do PIX/Boleto, sua conta será atualizada automaticamente.",
          defaultPrimary: { label: "Atualizar status", onClick: () => window.location.reload() },
          defaultSecondary: { label: "Ir para o Início", to: "/" },
        };
      case "limit-reached":
        return {
          code: code || "LIMITE ATINGIDO",
          icon: CustomIcon || AlertTriangle,
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200",
          title: title || "Limite do plano atingido",
          description: description || "Você atingiu o limite de projetos ou exportações do seu plano atual. Faça o upgrade para continuar expandindo.",
          defaultPrimary: { label: "Conhecer planos superiores", to: "/subscription" },
          defaultSecondary: { label: "Gerenciar projetos", to: "/projects" },
        };
      default:
        return {
          code: code || "",
          icon: CustomIcon || AlertCircle,
          iconBg: "bg-slate-100 text-slate-700",
          title: title || "Aviso do sistema",
          description: description || "",
          defaultPrimary: { label: "Voltar ao início", to: "/" },
          defaultSecondary: null,
        };
    }
  })();

  const IconComponent = config.icon;

  return (
    <div className={`mx-auto w-full max-w-md text-center py-10 px-4 ${className}`}>
      {/* Icon Pill */}
      <div className="flex justify-center mb-6">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ${config.iconBg}`}>
          <IconComponent className="h-8 w-8" />
        </div>
      </div>

      {/* Discrete Code Badge */}
      {config.code && (
        <div className="mb-3">
          <span className="inline-block rounded-md border border-[#E2E8F0] bg-white px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#64748B] shadow-xs">
            {config.code}
          </span>
        </div>
      )}

      {/* Title & Description */}
      <div className="space-y-2.5 mb-8">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A]">
          {config.title}
        </h1>
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-[#64748B]">
          {config.description}
        </p>

        {/* Error ID tracking if present */}
        {errorId && (
          <div className="mt-4 inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-mono text-slate-600 border border-slate-200">
            ID do Erro: <span className="font-bold text-slate-800">{errorId}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {primaryAction ? (
          primaryAction
        ) : config.defaultPrimary ? (
          config.defaultPrimary.to ? (
            <Button asChild className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm">
              <Link to={config.defaultPrimary.to}>
                {config.defaultPrimary.label}
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={config.defaultPrimary.onClick}
              className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {config.defaultPrimary.label}
            </Button>
          )
        ) : null}

        {secondaryAction ? (
          secondaryAction
        ) : config.defaultSecondary ? (
          config.defaultSecondary.to ? (
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to={config.defaultSecondary.to}>
                {config.defaultSecondary.label}
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={config.defaultSecondary.onClick}
              className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              {config.defaultSecondary.label}
            </Button>
          )
        ) : null}
      </div>

      {/* Auxiliary Links */}
      {auxiliaryLinks ? (
        <div className="mt-8 pt-6 border-t border-[#F1F5F9] text-xs font-bold text-[#64748B]">
          {auxiliaryLinks}
        </div>
      ) : (
        <div className="mt-8 pt-6 border-t border-[#F1F5F9] flex items-center justify-center gap-4 text-xs font-bold text-[#94A3B8]">
          <Link to="/ajuda" className="hover:text-[#00d8b8] transition">Central de Ajuda</Link>
          <span>•</span>
          <Link to="/suporte" className="hover:text-[#00d8b8] transition">Falar com Suporte</Link>
          <span>•</span>
          <Link to="/status" className="hover:text-[#00d8b8] transition">Status</Link>
        </div>
      )}
    </div>
  );
}
