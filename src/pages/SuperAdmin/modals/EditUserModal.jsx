import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  Loader2,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { DEFAULT_ROLES, isSuperAdmin } from "@/lib/rbac";

export default function EditUserModal({ open, onOpenChange, user, onUserUpdated }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [profession, setProfession] = useState("projetista");
  const [status, setStatus] = useState("active");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setRole(user.role || "user");
      setProfession(user.profession || user.profissao || "projetista");
      setStatus(user.status || "active");
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!fullName.trim()) {
      setErrorMessage("O nome completo é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      const updated = await backend.entities.SuperAdmin.updateUser(user.id, {
        full_name: fullName.trim(),
        role,
        profession,
        profissao: profession,
        status,
      });

      setSuccessMessage("Dados atualizados com sucesso!");
      if (onUserUpdated) onUserUpdated(updated);
      setTimeout(() => {
        onOpenChange(false);
      }, 1200);
    } catch (err) {
      console.error("Erro ao atualizar usuário:", err);
      setErrorMessage(err.message || "Falha ao salvar alterações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="text-lg font-black text-[#0F172A] flex items-center gap-2">
            <Edit className="h-5 w-5 text-[#00d8b8]" />
            Editar Usuário
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Altere os dados cadastrais, cargo, status da conta e nível de acesso.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-[#0F172A]">Nome Completo</Label>
            <Input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9 rounded-xl text-xs border-[#CBD5E1]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-[#0F172A]">E-mail</Label>
            <Input
              type="email"
              disabled
              value={email}
              className="h-9 rounded-xl text-xs border-[#CBD5E1] bg-slate-100 text-slate-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-[#94A3B8]">
              * O e-mail é o identificador único da conta e não pode ser alterado diretamente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#0F172A]">Nível de Acesso (RBAC)</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
              >
                {DEFAULT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Nível {r.level})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#0F172A]">Status da Conta</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
              >
                <option value="active">Ativo (Acesso Liberado)</option>
                <option value="suspended">Bloqueado / Suspenso</option>
                <option value="pending">Pendente de Ativação</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-[#0F172A]">Profissão / Cargo</Label>
            <select
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
            >
              <option value="projetista">Projetista Elétrico</option>
              <option value="eletricista">Engenheiro / Eletricista</option>
              <option value="arquiteto">Arquiteto</option>
              <option value="tecnico">Técnico Eletrotécnico</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9 rounded-xl text-xs font-bold border-[#CBD5E1]"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-5 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
