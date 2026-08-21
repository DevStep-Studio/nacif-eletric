import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { fileToDataUrl } from "@/lib/appPreferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFESSIONS, professionLabel } from "@/lib/professionalAccess";
import { CreditCard, LogOut, Palette, Save, Settings as SettingsIcon, Upload } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const initialsFromUser = (user) => {
  const source = user?.full_name || user?.email || "AD";
  const parts = source.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] || "AD").slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function SettingsPage() {
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ full_name: "", profession: "", company: "", crea: "", phone: "", avatar_url: "" });
  const [saving, setSaving] = useState(false);

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
    });
  }, []);

  const save = async (patch = form) => {
    setSaving(true);
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
    setSaving(false);
  };

  const handleAvatar = async (file) => {
    if (!file) return;
    const avatar_url = await fileToDataUrl(file);
    const next = { ...form, avatar_url };
    setForm(next);
    await save(next);
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-7 pb-20">
      <PageHeader
        icon={SettingsIcon}
        title="Configurações"
        subtitle="Conta, perfil profissional e plano de uso."
        actions={user?.role === "admin" && (
          <Button asChild variant="outline" className="h-11 rounded-[12px] font-extrabold">
            <Link to="/admin">
              <Palette className="h-4 w-4" />
              Aparência do sistema
            </Link>
          </Button>
        )}
      />

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

      <Button variant="outline" className="mx-auto h-11 w-full max-w-5xl rounded-[12px] font-extrabold" onClick={() => logout()}>
        <LogOut className="h-4 w-4" />
        Sair da conta
      </Button>
    </div>
  );
}
