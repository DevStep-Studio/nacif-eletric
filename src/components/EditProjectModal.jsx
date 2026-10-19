import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { backend } from "@/api/backendClient";
import { Edit3, Loader2 } from "lucide-react";

export default function EditProjectModal({ isOpen, onClose, project, onSuccess }) {
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    address: "",
    city: "",
    supply_type: "Monofásico",
    voltage: 220,
    project_type: "Instalações Elétricas",
    status: "em_andamento",
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || "",
        client_name: project.client_name || project.client || "",
        address: project.address || "",
        city: project.city || "",
        supply_type: project.supply_type || "Monofásico",
        voltage: project.voltage || 220,
        project_type: project.project_type || "Instalações Elétricas",
        status: project.status || "em_andamento",
      });
      setErrorMsg("");
    }
  }, [project, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg("O nome do projeto é obrigatório.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      const updated = await backend.entities.Project.update(project.id, {
        name: form.name.trim(),
        client_name: form.client_name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        supply_type: form.supply_type,
        voltage: Number(form.voltage),
        project_type: form.project_type,
        status: form.status,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      console.error("Erro ao salvar alterações do projeto:", err);
      setErrorMsg(err?.message || "Falha ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-black">
            <Edit3 className="h-5 w-5 text-[#00d8b8]" />
            <DialogTitle className="text-lg font-black text-[#0F172A]">
              Editar Informações do Projeto
            </DialogTitle>
          </div>
          <p className="text-xs text-[#64748B]">
            Altere os dados cadastrais, localidade e configurações elétricas básicas do projeto.
          </p>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          <div className="space-y-1.5">
            <Label className="font-bold text-[#0F172A]">Nome do Projeto *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Residência Vila Nova"
              className="h-10 rounded-xl text-xs font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-bold text-[#0F172A]">Cliente / Proprietário</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="Ex: Carlos Eduardo"
                className="h-10 rounded-xl text-xs font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-[#0F172A]">Cidade / UF</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ex: Belo Horizonte - MG"
                className="h-10 rounded-xl text-xs font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-bold text-[#0F172A]">Endereço da Obra</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rua, número, bairro"
              className="h-10 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-bold text-[#0F172A]">Alimentação</Label>
              <Select
                value={form.supply_type}
                onValueChange={(val) => setForm({ ...form, supply_type: val })}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monofásico">Monofásico</SelectItem>
                  <SelectItem value="Bifásico">Bifásico</SelectItem>
                  <SelectItem value="Trifásico">Trifásico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-[#0F172A]">Tensão Nominal (V)</Label>
              <Select
                value={String(form.voltage)}
                onValueChange={(val) => setForm({ ...form, voltage: Number(val) })}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="127">127 V</SelectItem>
                  <SelectItem value="220">220 V</SelectItem>
                  <SelectItem value="380">380 V</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-bold text-[#0F172A]">Disciplina</Label>
              <Select
                value={form.project_type}
                onValueChange={(val) => setForm({ ...form, project_type: val })}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instalações Elétricas">Instalações Elétricas</SelectItem>
                  <SelectItem value="Solar">Solar Fotovoltaico</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-[#0F172A]">Status do Projeto</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val })}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="pendente">Pendente revisão</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
