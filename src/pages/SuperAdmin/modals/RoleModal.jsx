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
  Loader2,
  Shield,
} from "lucide-react";
import { SYSTEM_MODULES, ACTIONS } from "@/lib/rbac";
import { recordAuditEvent } from "@/lib/auditLogger";

export default function RoleModal({ open, onOpenChange, role, onRoleSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(3);
  const [permissions, setPermissions] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role) {
      setName(role.name || "");
      setDescription(role.desc || "");
      setLevel(role.level || 3);
      setPermissions(role.permissions || {});
    } else {
      setName("");
      setDescription("");
      setLevel(3);
      // Inicializa matriz limpa
      const initial = {};
      SYSTEM_MODULES.forEach((mod) => {
        initial[mod.id] = { view: false, create: false, edit: false, delete: false, admin: false };
      });
      setPermissions(initial);
    }
    setErrorMessage("");
  }, [role, open]);

  const handleToggle = (moduleId, actionId) => {
    setPermissions((prev) => {
      const currentMod = prev[moduleId] || {};
      const nextVal = !currentMod[actionId];
      return {
        ...prev,
        [moduleId]: {
          ...currentMod,
          [actionId]: nextVal,
        },
      };
    });
  };

  const handleSelectAll = (select = true) => {
    const next = {};
    SYSTEM_MODULES.forEach((mod) => {
      next[mod.id] = {};
      ACTIONS.forEach((act) => {
        next[mod.id][act.id] = select;
      });
    });
    setPermissions(next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Por favor, informe o nome do papel / nível.");
      return;
    }

    setLoading(true);
    try {
      const rolePayload = {
        id: role?.id || `role_${Date.now()}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        name: name.trim(),
        desc: description.trim(),
        level: Number(level),
        permissions,
        is_system: false,
        badge_color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };

      recordAuditEvent({
        action: role ? "ROLE_UPDATED" : "ROLE_CREATED",
        targetType: "role",
        targetId: rolePayload.id,
        targetName: rolePayload.name,
        details: `${role ? "Atualizado" : "Criado"} nível personalizado "${rolePayload.name}"`,
      });

      if (onRoleSaved) onRoleSaved(rolePayload);
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar papel:", err);
      setErrorMessage(err.message || "Falha ao salvar papel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="text-lg font-black text-[#0F172A] flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#00d8b8]" />
            {role ? `Configurar Papel: ${role.name}` : "Criar Novo Nível Personalizado"}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Configure o nome do papel, nível hierárquico e a matriz granular de permissões por módulo e ação.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-bold text-[#0F172A]">Nome do Papel <span className="text-rose-500">*</span></Label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Gestor de Projetos Solar"
                className="h-9 rounded-xl text-xs border-[#CBD5E1]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#0F172A]">Nível Hierárquico</Label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A]"
              >
                <option value="2">Nível 2 (Administrativo)</option>
                <option value="3">Nível 3 (Operacional / Técnico)</option>
                <option value="4">Nível 4 (Visualizador / Restrito)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-[#0F172A]">Descrição do Papel</Label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Permite elaboração de projetos e plantas sem acesso a configurações administrativas."
              className="h-9 rounded-xl text-xs border-[#CBD5E1]"
            />
          </div>

          {/* Matriz de Permissões */}
          <div className="space-y-2 border-t border-[#E2E8F0] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                  Matriz de Permissões Granulares
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Defina com precisão quais ações este papel poderá executar em cada módulo do sistema.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                  className="h-7 text-[11px] font-bold rounded-lg border-[#CBD5E1]"
                >
                  Marcar Todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(false)}
                  className="h-7 text-[11px] font-bold rounded-lg border-[#CBD5E1]"
                >
                  Desmarcar Todos
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="p-3 min-w-[200px]">Módulo</th>
                      {ACTIONS.map((act) => (
                        <th key={act.id} className="p-3 text-center min-w-[80px]">
                          {act.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {SYSTEM_MODULES.map((mod) => (
                      <tr key={mod.id} className="hover:bg-[#F8FAFC]/60 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-[#0F172A]">{mod.name}</p>
                          <p className="text-[10px] text-[#94A3B8]">{mod.desc}</p>
                        </td>
                        {ACTIONS.map((act) => {
                          const isChecked = Boolean(permissions[mod.id]?.[act.id]);
                          return (
                            <td key={act.id} className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggle(mod.id, act.id)}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
                                  isChecked
                                    ? "bg-[#00d8b8] border-[#00d8b8] text-[#0F172A]"
                                    : "bg-white border-[#CBD5E1] text-transparent hover:border-[#94A3B8]"
                                }`}
                              >
                                <CheckCircle2 className="h-4 w-4 stroke-[3]" />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : (
                "Salvar Nível e Permissões"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
