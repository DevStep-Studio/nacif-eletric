import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { fileToDataUrl } from "@/lib/appPreferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFESSIONS, professionLabel, isSuperAdmin } from "@/lib/professionalAccess";
import {
  CreditCard,
  Lock,
  LogOut,
  Palette,
  Save,
  Settings as SettingsIcon,
  Shield,
  Sliders,
  Upload,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

const initialsFromUser = (user) => {
  const source = user?.full_name || user?.email || "AD";
  const parts = source.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] || "AD").slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function SettingsPage() {
  const { logout, checkUserAuth } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ full_name: "", profession: "", company: "", crea: "", phone: "", avatar_url: "" });
  const [saving, setSaving] = useState(false);

  // Estados de Segurança / Alteração de Senha
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({ type: "", message: "" });

  // Estados de Preferências do Sistema
  const [preferences, setPreferences] = useState({
    notify_projects: true,
    notify_issues: true,
    notify_compliance: true,
    unit_system: "metric",
    date_format: "DD/MM/YYYY",
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  useEffect(() => {
    backend.auth.me().then((u) => {
      setUser(u);
      setForm({
        full_name: u.full_name || "",
        profession: u.profession || u.profissao || "",
        company: u.company || "",
        crea: u.crea || "",
        phone: u.phone || "",
        avatar_url: u.avatar_url || u.profile_photo_url || u.photo_url || "",
      });
      if (u.preferences) {
        setPreferences((prev) => ({ ...prev, ...u.preferences }));
      }
    });
  }, []);

  const save = async (patch = form) => {
    setSaving(true);
    try {
      const updated = await backend.auth.updateMe(patch);
      setUser(updated);
      setForm({
        full_name: updated.full_name || "",
        profession: updated.profession || updated.profissao || "",
        company: updated.company || "",
        crea: updated.crea || "",
        phone: updated.phone || "",
        avatar_url: updated.avatar_url || "",
      });
      window.dispatchEvent(new CustomEvent("voltai:user-updated"));
      await checkUserAuth();
    } catch (err) {
      console.error("Erro ao salvar dados do perfil:", err);
      alert("Não foi possível salvar as configurações. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (file) => {
    if (!file) return;
    const avatar_url = await fileToDataUrl(file);
    const next = { ...form, avatar_url };
    setForm(next);
    await save(next);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordFeedback({ type: "", message: "" });

    if (!passwordForm.current_password) {
      setPasswordFeedback({ type: "error", message: "Informe sua senha atual para continuar." });
      return;
    }

    if (!passwordForm.new_password || passwordForm.new_password.length < 6) {
      setPasswordFeedback({ type: "error", message: "A nova senha deve conter no mínimo 6 caracteres." });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordFeedback({ type: "error", message: "A confirmação da nova senha não confere." });
      return;
    }

    setPasswordSaving(true);
    try {
      await backend.auth.updateMe({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });

      setPasswordFeedback({ type: "success", message: "Senha alterada com sucesso!" });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => setPasswordFeedback({ type: "", message: "" }), 5000);
    } catch (err) {
      setPasswordFeedback({
        type: "error",
        message: err.message || "Não foi possível alterar a senha. Verifique a senha atual e tente novamente.",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setPrefsSaving(true);
    setPrefsSuccess(false);
    try {
      const updated = await backend.auth.updateMe({ preferences });
      setUser(updated);
      setPrefsSuccess(true);
      setTimeout(() => setPrefsSuccess(false), 4000);
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
      alert("Não foi possível salvar as preferências do sistema.");
    } finally {
      setPrefsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-7 pb-20">
      <PageHeader
        icon={SettingsIcon}
        title="Configurações"
        subtitle="Conta, perfil profissional, segurança e preferências do sistema."
        actions={(isSuperAdmin(user) || user?.role === "admin") && (
          <Button asChild variant="outline" className="h-11 rounded-[12px] font-extrabold">
            <Link to="/admin">
              <Palette className="h-4 w-4" />
              Aparência do sistema
            </Link>
          </Button>
        )}
      />

      {/* Perfil Cadastral */}
      <section className="mx-auto w-full max-w-5xl rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 text-xl font-extrabold text-primary">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                initialsFromUser(user)
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold text-[#0f1728]">{form.full_name || user?.email}</p>
              <p className="truncate text-sm font-medium text-[#5f6877]">{user?.email}</p>
              <Badge className="mt-2 w-fit rounded-[10px] bg-primary text-primary-foreground">{user?.plan || "gratuito"}</Badge>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-[#7a8495]">
                {professionLabel(form.profession || user?.profession || user?.profissao)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Label
              htmlFor="settings-avatar-upload"
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Trocar foto
            </Label>
            <input id="settings-avatar-upload" type="file" accept="image/*" className="hidden" onChange={(event) => handleAvatar(event.target.files?.[0])} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-2 h-11 rounded-[10px]" />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="mt-2 h-11 rounded-[10px]" />
          </div>
          <div>
            <Label>Profissão</Label>
            <select
              value={form.profession}
              onChange={(event) => setForm({ ...form, profession: event.target.value })}
              className="mt-2 h-11 w-full rounded-[10px] border border-input bg-background px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PROFESSIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>CREA/CAU</Label>
            <Input value={form.crea} onChange={(event) => setForm({ ...form, crea: event.target.value })} className="mt-2 h-11 rounded-[10px]" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 h-11 rounded-[10px]" />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" className="h-11 rounded-[12px] px-6 font-extrabold" onClick={() => save()} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </div>
      </section>

      {/* Alteração de Senha & Segurança */}
      <section className="mx-auto w-full max-w-5xl rounded-[16px] border border-[#CDEFE8] bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.04)] space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#0f1728]">
            <Lock className="h-5 w-5 text-primary" />
            Segurança & Alteração de Senha
          </h2>
          <p className="mt-1 text-sm font-medium text-[#5f6877]">
            Para alterar sua senha, confirme a senha atual para validação de segurança.
          </p>
        </div>

        {passwordFeedback.message && (
          <div
            className={`rounded-xl p-3 text-xs font-bold ${
              passwordFeedback.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {passwordFeedback.message}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="grid gap-4 md:grid-cols-3 pt-2">
          <div>
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha atual"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              className="mt-2 h-11 rounded-[10px]"
            />
          </div>
          <div>
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              className="mt-2 h-11 rounded-[10px]"
            />
          </div>
          <div>
            <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              className="mt-2 h-11 rounded-[10px]"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <Button
              type="submit"
              disabled={passwordSaving || !passwordForm.current_password || !passwordForm.new_password}
              className="h-11 rounded-[12px] px-6 font-extrabold"
            >
              <Shield className="h-4 w-4" />
              {passwordSaving ? "Atualizando..." : "Atualizar senha"}
            </Button>
          </div>
        </form>
      </section>

      {/* Preferências do Sistema & Notificações */}
      <section className="mx-auto w-full max-w-5xl rounded-[16px] border border-[#CDEFE8] bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.04)] space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#0f1728]">
            <Sliders className="h-5 w-5 text-primary" />
            Preferências do Sistema & Notificações
          </h2>
          <p className="mt-1 text-sm font-medium text-[#5f6877]">
            Controle os avisos exibidos e os formatos de cálculo utilizados em sua conta.
          </p>
        </div>

        {prefsSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            Preferências salvas com sucesso!
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-3.5 cursor-pointer hover:bg-[#F8FAFC] transition">
              <input
                type="checkbox"
                checked={preferences.notify_projects}
                onChange={(e) => setPreferences({ ...preferences, notify_projects: e.target.checked })}
                className="mt-0.5 rounded border-[#CBD5E1] text-primary focus:ring-primary"
              />
              <div className="text-xs">
                <p className="font-extrabold text-[#0F172A]">Avisos de Projetos e Circuitos</p>
                <p className="text-[#64748B] mt-0.5">Notificar sobre projetos vazios ou pendências de circuitos.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-3.5 cursor-pointer hover:bg-[#F8FAFC] transition">
              <input
                type="checkbox"
                checked={preferences.notify_issues}
                onChange={(e) => setPreferences({ ...preferences, notify_issues: e.target.checked })}
                className="mt-0.5 rounded border-[#CBD5E1] text-primary focus:ring-primary"
              />
              <div className="text-xs">
                <p className="font-extrabold text-[#0F172A]">Respostas de Avisos e Erros</p>
                <p className="text-[#64748B] mt-0.5">Notificar quando a equipe responder ou atualizar um relato.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-3.5 cursor-pointer hover:bg-[#F8FAFC] transition">
              <input
                type="checkbox"
                checked={preferences.notify_compliance}
                onChange={(e) => setPreferences({ ...preferences, notify_compliance: e.target.checked })}
                className="mt-0.5 rounded border-[#CBD5E1] text-primary focus:ring-primary"
              />
              <div className="text-xs">
                <p className="font-extrabold text-[#0F172A]">Alertas de Conformidade NBR 5410</p>
                <p className="text-[#64748B] mt-0.5">Exibir avisos em tempo real sobre score de normas técnicas.</p>
              </div>
            </label>

            <div className="rounded-xl border border-[#E2E8F0] p-3.5 space-y-1">
              <Label className="text-xs font-extrabold text-[#0F172A]">Unidade de Medida</Label>
              <select
                value={preferences.unit_system}
                onChange={(e) => setPreferences({ ...preferences, unit_system: e.target.value })}
                className="h-9 w-full rounded-[10px] border border-input bg-background px-3 text-xs font-semibold"
              >
                <option value="metric">Sistema Métrico (Metros, mm², kW)</option>
                <option value="imperial">Sistema Imperial (Pés, AWG, HP)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSavePreferences}
              disabled={prefsSaving}
              className="h-11 rounded-[12px] px-6 font-extrabold"
            >
              <Save className="h-4 w-4" />
              {prefsSaving ? "Salvando preferências..." : "Salvar preferências"}
            </Button>
          </div>
        </div>
      </section>

      {/* Assinatura e Uso */}
      <section className="mx-auto w-full max-w-5xl rounded-[16px] border border-[#CDEFE8] bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#0f1728]">
              <CreditCard className="h-5 w-5 text-primary" />
              Assinatura e uso
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#5f6877]">
              Planos, limites, uso e cobrança ficam centralizados em uma página própria.
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-[12px] font-extrabold">
            <Link to="/subscription">Gerenciar assinatura</Link>
          </Button>
        </div>
      </section>

      {/* Privacidade & LGPD */}
      <section className="mx-auto w-full max-w-5xl rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.04)] space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#0f1728]">
            Privacidade & Dados (LGPD)
          </h2>
          <p className="mt-1 text-sm font-medium text-[#5f6877]">
            Portabilidade de dados, direitos do titular e controle de conta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button asChild variant="outline" className="h-10 rounded-[12px] text-xs font-bold">
            <Link to="/configuracoes/exportar-dados">Exportar meus dados (JSON)</Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-[12px] text-xs font-bold">
            <Link to="/privacidade/direitos">Portal do Titular (LGPD)</Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-[12px] text-xs font-bold text-red-600 border-red-200 hover:bg-red-50">
            <Link to="/configuracoes/excluir-conta">Excluir conta</Link>
          </Button>
        </div>
      </section>

      <Button variant="outline" className="mx-auto h-11 w-full max-w-5xl rounded-[12px] font-extrabold" onClick={() => logout()}>
        <LogOut className="h-4 w-4" />
        Sair da conta
      </Button>
    </div>
  );
}
