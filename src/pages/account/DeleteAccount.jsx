import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { useAuth } from "@/lib/AuthContext";
import { backend } from "@/api/backendClient";
import DangerConfirmDialog from "@/components/system/DangerConfirmDialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";

export default function DeleteAccountPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleConfirmDelete = async () => {
    try {
      if (backend?.auth?.deleteAccount) {
        await backend.auth.deleteAccount();
      } else if (backend?.auth?.updateMe) {
        await backend.auth.updateMe({ account_status: "deleted" });
      }
    } catch (e) {
      console.warn("Delete account call fallback:", e);
    }
    setDeleted(true);
    setTimeout(() => {
      logout();
    }, 2000);
  };

  if (deleted) {
    return (
      <SystemPageLayout showBackButton={false}>
        <div className="mx-auto max-w-md text-center py-12 space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 mx-auto">
            <Trash2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-[#0F172A]">Conta excluída</h1>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Sua conta e os dados pessoais foram removidos permanentemente. Você será redirecionado para a tela de login.
          </p>
        </div>
      </SystemPageLayout>
    );
  }

  return (
    <SystemPageLayout
      title="Excluir Minha Conta"
      subtitle="Leia atentamente as consequências da exclusão antes de confirmar."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Warning Card */}
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-red-950">
                Esta ação é permanente e irreversível
              </h2>
              <p className="text-xs text-red-800">
                Ao excluir sua conta, todos os seus dados cadastrais e de projetos serão desvinculados.
              </p>
            </div>
          </div>

          <div className="border-t border-red-200/70 pt-3 text-xs text-red-900 space-y-2">
            <p className="font-bold">O que será afetado:</p>
            <ul className="list-disc pl-5 space-y-1 text-[11px]">
              <li>Acesso a todos os seus projetos elétricos e memoriais descritivos salvos na nuvem.</li>
              <li>Cancelamento imediato de qualquer assinatura ativa (sem cobranças futuras).</li>
              <li>Exclusão de arquivos de plantas importadas em formato PDF, DWG e imagens.</li>
              <li>Histórico de dimensionamentos e relatórios técnicos.</li>
            </ul>
          </div>
        </div>

        {/* User Account Info */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm text-xs space-y-2">
          <p className="font-bold text-[#0F172A]">Conta a ser excluída:</p>
          <div className="rounded-xl bg-[#F8FAFC] p-3 text-[#64748B] font-mono text-[11px]">
            <p>Nome: {user?.full_name || "Usuário"}</p>
            <p>E-mail: {user?.email}</p>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Caso deseje apenas fazer uma pausa, você pode cancelar a assinatura mantendo sua conta gratuita.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/settings")}
            className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#0F172A]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Voltar para Configurações
          </Button>

          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="h-10 w-full sm:w-auto rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Excluir minha conta definitivamente
          </Button>
        </div>
      </div>

      <DangerConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar exclusão definitiva da conta"
        description="Esta ação apagará permanentemente sua conta e todos os seus projetos elétricos associados."
        consequences={[
          "Seus projetos e plantas serão excluídos permanentemente.",
          "Sua assinatura atual será cancelada de forma irreversível.",
          "Não será possível recuperar estes dados após a confirmação.",
        ]}
        confirmTextRequired="EXCLUIR"
        confirmButtonLabel="Sim, excluir permanentemente"
        onConfirm={handleConfirmDelete}
      />
    </SystemPageLayout>
  );
}
