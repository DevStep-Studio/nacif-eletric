import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { backend } from "@/api/backendClient";

export default function ResetPasswordModal({ open, onOpenChange, user }) {
  const [loading, setLoading] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleGenerateLink = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await backend.entities.SuperAdmin.sendPasswordReset(user.id);
      setRecoveryLink(result.recoveryLink);
    } catch (err) {
      console.error("Erro ao gerar link de redefinição:", err);
      setErrorMessage(err.message || "Falha ao gerar link de redefinição.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!recoveryLink) return;
    navigator.clipboard.writeText(recoveryLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleClose = () => {
    setRecoveryLink("");
    setCopied(false);
    setErrorMessage("");
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="text-lg font-black text-[#0F172A] flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#00d8b8]" />
            Redefinir Acesso de Conta
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Gere um link seguro de recuperação e criação de nova senha para o usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1">
            <p><strong>Usuário:</strong> {user.full_name}</p>
            <p><strong>E-mail:</strong> {user.email}</p>
            <p><strong>Nível:</strong> {user.role}</p>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          {recoveryLink ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Link de redefinição gerado com sucesso!</span>
                </div>
                <p className="text-[11px] text-[#475467]">
                  Envie o link abaixo para o usuário. O token é de uso único e expira automaticamente:
                </p>
                <div className="rounded-lg border border-emerald-300 bg-white p-2 text-[11px] font-mono break-all text-[#0F172A] select-all">
                  {recoveryLink}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5 border-[#CBD5E1]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Link Copiado!" : "Copiar Link"}
                </Button>

                <Button
                  type="button"
                  onClick={handleClose}
                  className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-4"
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[#64748B]">
                Ao confirmar, o sistema registrará a ação de auditoria e invalidará links anteriores para esta conta.
              </p>

              <div className="flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="h-9 rounded-xl text-xs font-bold border-[#CBD5E1]"
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Gerando link...
                    </>
                  ) : (
                    "Gerar Link Seguro"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
