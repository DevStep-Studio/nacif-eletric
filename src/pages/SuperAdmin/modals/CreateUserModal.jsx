import { useState } from "react";
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
  Copy,
  Loader2,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { DEFAULT_ROLES } from "@/lib/rbac";
import { PROFESSIONS } from "@/lib/professionalAccess";

export default function CreateUserModal({ open, onOpenChange, onUserCreated }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [profession, setProfession] = useState("projetista");
  const [customPassword, setCustomPassword] = useState("");
  const [status, setStatus] = useState("active");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setRole("user");
    setProfession("projetista");
    setCustomPassword("");
    setStatus("active");
    setErrorMessage("");
    setSuccessData(null);
    setCopied(false);
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen && !loading) {
      resetForm();
      onOpenChange(false);
    } else if (isOpen) {
      setErrorMessage("");
      onOpenChange(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Por favor, preencha o nome completo.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Por favor, informe um e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      const result = await backend.entities.SuperAdmin.createUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        profession,
        password: customPassword.trim() || undefined,
        status,
      });

      setSuccessData(result);
      if (onUserCreated) onUserCreated(result.user);
    } catch (err) {
      console.error("Erro ao cadastrar usuário:", err);
      setErrorMessage(err.message || "Falha ao cadastrar usuário.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successData) return;
    const text = `Acesso Nacif Electric:\nE-mail: ${successData.user.email}\nSenha Temporária: ${successData.temporary_password}\nLink: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
        {successData ? (
          // Tela de Sucesso com Credenciais Seguras
          <div className="py-6 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8FCF8] text-[#00d8b8] mx-auto shadow-sm">
              <CheckCircle2 className="h-6 w-6 text-[#00d8b8]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-[#0F172A]">
                Usuário cadastrado com sucesso!
              </h2>
              <p className="text-xs text-[#64748B]">
                A conta foi criada e ativada no sistema com as credenciais abaixo:
              </p>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-[#64748B]">Nome:</span>
                <span className="font-bold text-[#0F172A]">{successData.user.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#64748B]">E-mail:</span>
                <span className="font-bold text-[#0F172A]">{successData.user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#64748B]">Nível:</span>
                <span className="font-bold text-[#0F172A] capitalize">{successData.user.role}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[#E2E8F0]">
                <span className="font-semibold text-[#64748B]">Senha Inicial:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {successData.temporary_password}
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyCredentials}
                className="h-9 rounded-xl text-xs font-bold gap-1.5 border-[#CBD5E1]"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Credenciais Copiadas!" : "Copiar Acesso"}
              </Button>

              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-5 shadow-sm"
              >
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          // Formulário de Cadastro
          <div className="space-y-4">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#00d8b8]" />
                Cadastrar Novo Usuário
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Informe os dados do usuário, defina o nível de acesso e o papel no sistema.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#0F172A]">
                  Nome Completo <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Gabriel Rezende de Castro"
                  className="h-9 rounded-xl text-xs border-[#CBD5E1]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#0F172A]">
                  E-mail de Acesso <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@nacifelectric.com.br"
                  className="h-9 rounded-xl text-xs border-[#CBD5E1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#0F172A]">
                    Nível de Acesso (RBAC) <span className="text-rose-500">*</span>
                  </Label>
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
                  <Label className="text-xs font-bold text-[#0F172A]">
                    Profissão / Cargo
                  </Label>
                  <select
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
                  >
                    {PROFESSIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-[#0F172A]">Senha Inicial</Label>
                    <span className="text-[10px] text-[#94A3B8]">Opcional</span>
                  </div>
                  <Input
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Gerar automaticamente se vazio"
                    className="h-9 rounded-xl text-xs border-[#CBD5E1]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#0F172A]">Status da Conta</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
                  >
                    <option value="active">Ativo (Acesso Liberado)</option>
                    <option value="pending">Pendente de Ativação</option>
                    <option value="suspended">Bloqueado / Suspenso</option>
                  </select>
                </div>
              </div>

              {role === "super_admin" && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-2.5 text-[11px] text-purple-800 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
                  <span>
                    <strong>Atenção:</strong> O perfil <strong>Super Administrador</strong> concede autoridade máxima no sistema, incluindo gestão de todos os usuários e configurações.
                  </span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={loading}
                  className="h-9 rounded-xl text-xs font-bold border-[#CBD5E1]"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-5 shadow-sm gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar Usuário"
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
