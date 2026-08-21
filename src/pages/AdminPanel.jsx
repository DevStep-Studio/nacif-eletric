import { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { useNavigate } from "react-router-dom";
import {
  BellRing,
  CheckCircle2,
  CreditCard,
  FolderOpen,
  Image,
  Palette,
  RotateCcw,
  Send,
  Shield,
  Trash2,
  Upload,
  UserCircle,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import {
  THEME_PRESETS,
  fileToDataUrl,
  formatNotificationTime,
  useBranding,
  useNotifications,
} from "@/lib/appPreferences";
import { PROFESSIONS, professionLabel } from "@/lib/professionalAccess";

const profileInitials = (user) => {
  const source = user?.full_name || user?.email || "Admin";
  const parts = source.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] || "AD").slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

function PreviewLogo({ value, label, fallbackIcon: FallbackIcon = Zap }) {
  return (
    <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-[16px] border border-[#CDEFE8] bg-[#F2FFFC]">
      {value ? (
        <img src={value} alt={label} className="h-full w-full object-contain p-3" />
      ) : (
        <FallbackIcon className="h-7 w-7 text-primary" />
      )}
    </div>
  );
}

function LogoUpload({ id, label, description, value, onChange, onClear }) {
  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-[#CDEFE8] bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center">
      <PreviewLogo value={value} label={label} fallbackIcon={Image} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[#0f1728]">{label}</p>
        <p className="mt-1 text-sm font-medium leading-5 text-[#5f6877]">{description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Label
          htmlFor={id}
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#BCEEE5] bg-[#F2FFFC] px-4 text-sm font-extrabold text-[#111827] transition hover:bg-[#E8FCF8]"
        >
          <Upload className="h-4 w-4" />
          Enviar
        </Label>
        <input id={id} type="file" accept="image/*" className="hidden" onChange={onChange} />
        {value && (
          <Button type="button" variant="outline" className="h-10 rounded-[10px]" onClick={onClear}>
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const { branding, updateBranding, applyPreset, resetBranding } = useBranding();
  const { notifications, unreadCount, markAllRead, clearAll, addNotification } = useNotifications(currentUser);
  const [brandingForm, setBrandingForm] = useState(branding);
  const [profileForm, setProfileForm] = useState({ full_name: "", company: "", crea: "", phone: "", avatar_url: "" });
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    description: "",
    tone: "info",
    category: "Admin",
    href: "/",
  });

  useEffect(() => {
    setBrandingForm(branding);
  }, [branding]);

  useEffect(() => {
    const load = async () => {
      const me = await backend.auth.me();
      if (me.role !== "admin") {
        navigate("/");
        return;
      }

      setCurrentUser(me);
      setProfileForm({
        full_name: me.full_name || "",
        company: me.company || "",
        crea: me.crea || "",
        phone: me.phone || "",
        avatar_url: me.avatar_url || me.profile_photo_url || me.photo_url || "",
      });

      const [u, p] = await Promise.all([
        backend.entities.User.list(),
        backend.entities.Project.list("-created_date", 100),
      ]);
      setUsers(u);
      setProjects(p);
      setLoading(false);
    };

    load();
  }, [navigate]);

  const updatePlan = async (userId, plan) => {
    await backend.entities.User.update(userId, { plan });
    setUsers(users.map((u) => (u.id === userId ? { ...u, plan } : u)));
  };

  const updateProfession = async (userId, profession) => {
    await backend.entities.User.update(userId, { profession });
    setUsers(users.map((u) => (u.id === userId ? { ...u, profession } : u)));
  };

  const handleBrandingFile = async (field, file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setBrandingForm((current) => ({ ...current, [field]: dataUrl }));
  };

  const saveBranding = () => {
    const next = updateBranding(brandingForm);
    setBrandingForm(next);
    addNotification({
      title: "Identidade visual atualizada",
      description: "Cores, logos e preferências de marca foram aplicadas ao sistema.",
      category: "Marca",
      tone: "success",
      href: "/admin",
    });
  };

  const saveProfile = async (patch = profileForm) => {
    setSaving("profile");
    const updated = await backend.auth.updateMe(patch);
    setCurrentUser(updated);
    setProfileForm({
      full_name: updated.full_name || "",
      company: updated.company || "",
      crea: updated.crea || "",
      phone: updated.phone || "",
      avatar_url: updated.avatar_url || "",
    });
    window.dispatchEvent(new CustomEvent("voltai:user-updated"));
    setSaving("");
  };

  const handleAvatarFile = async (file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const nextProfile = { ...profileForm, avatar_url: dataUrl };
    setProfileForm(nextProfile);
    await saveProfile(nextProfile);
  };

  const sendNotification = () => {
    if (!notificationForm.title.trim() || !notificationForm.description.trim()) return;
    addNotification({
      ...notificationForm,
      title: notificationForm.title.trim(),
      description: notificationForm.description.trim(),
    });
    setNotificationForm({
      title: "",
      description: "",
      tone: "info",
      category: "Admin",
      href: "/",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  const planCounts = { gratuito: 0, profissional: 0, engenharia: 0 };
  users.forEach((u) => {
    const plan = planCounts[u.plan] === undefined ? "gratuito" : u.plan;
    planCounts[plan] += 1;
  });
  const avatar = profileForm.avatar_url;

  return (
    <div className="w-full max-w-none space-y-7 pb-20">
      <PageHeader
        icon={Shield}
        title="Painel Administrativo"
        subtitle="Gestão de usuários, projetos, marca, perfil e notificações do sistema."
        actions={
          <Badge className="w-fit rounded-[10px] bg-primary px-4 py-1.5 text-sm text-primary-foreground">
            {currentUser?.role === "admin" ? "Administrador" : "Usuário"}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Usuários", value: users.length, icon: Users },
          { label: "Projetos", value: projects.length, icon: FolderOpen },
          { label: "Profissional", value: planCounts.profissional, icon: CreditCard },
          { label: "Notificações", value: unreadCount, icon: BellRing },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-[#CDEFE8] bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-primary" />
              <span className="rounded-[9px] bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">Ativo</span>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-[#0f1728]">{s.value}</p>
            <p className="mt-1 text-sm font-semibold text-[#687386]">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="appearance" className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start rounded-[14px] border border-[#CDEFE8] bg-white p-1">
          <TabsTrigger value="appearance" className="rounded-[10px] px-4 py-2.5 text-sm font-extrabold">Aparência</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-[10px] px-4 py-2.5 text-sm font-extrabold">Notificações</TabsTrigger>
          <TabsTrigger value="users" className="rounded-[10px] px-4 py-2.5 text-sm font-extrabold">Usuários</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-[10px] px-4 py-2.5 text-sm font-extrabold">Projetos</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
            <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#0f1728]">
                    <Palette className="h-5 w-5 text-primary" />
                    Aparência e marca
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#5f6877]">
                    Defina a identidade visual que será aplicada em todo o produto, incluindo login e navegação.
                  </p>
                </div>
                <Button type="button" variant="outline" className="rounded-[10px]" onClick={() => setBrandingForm(resetBranding())}>
                  <RotateCcw className="h-4 w-4" />
                  Restaurar
                </Button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nome do produto</Label>
                  <Input
                    value={brandingForm.appName}
                    onChange={(event) => setBrandingForm({ ...brandingForm, appName: event.target.value })}
                    className="mt-2 h-11 rounded-[10px]"
                  />
                </div>
                <div>
                  <Label>Sufixo da marca</Label>
                  <Input
                    value={brandingForm.appSuffix}
                    onChange={(event) => setBrandingForm({ ...brandingForm, appSuffix: event.target.value })}
                    className="mt-2 h-11 rounded-[10px]"
                  />
                </div>
              </div>

              <div className="mt-6">
                <Label>Paletas prontas</Label>
                <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setBrandingForm(applyPreset(preset.id))}
                      className="flex items-center gap-3 rounded-[16px] border border-[#CDEFE8] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: preset.secondaryColor }}>
                        <span className="h-5 w-5 rounded-full" style={{ background: preset.primaryColor }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-[#0f1728]">{preset.name}</span>
                        <span className="block text-xs font-semibold text-[#6b7280]">{preset.primaryColor}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                {[
                  ["primaryColor", "Cor principal"],
                  ["secondaryColor", "Fundo suave"],
                  ["accentColor", "Seleção/Menu"],
                  ["borderColor", "Bordas"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <div className="mt-2 flex h-11 items-center gap-2 rounded-[10px] border border-input bg-white px-2">
                      <input
                        type="color"
                        value={brandingForm[field]}
                        onChange={(event) => setBrandingForm({ ...brandingForm, [field]: event.target.value })}
                        className="h-8 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
                        aria-label={label}
                      />
                      <Input
                        value={brandingForm[field]}
                        onChange={(event) => setBrandingForm({ ...brandingForm, [field]: event.target.value })}
                        className="h-8 border-0 px-1 font-mono text-xs shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[20px] border border-[#CDEFE8] bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.045)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-xl">
                    <p className="text-base font-extrabold text-[#0f1728]">Logo do dashboard e login</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-[#5f6877]">
                      Defina as cores da marca padrão. A prévia mostra como o raio aparece na sidebar, no topo mobile e nas telas de autenticação.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-[10px] text-xs font-extrabold"
                      onClick={() => setBrandingForm({
                        ...brandingForm,
                        logoIconColor: brandingForm.primaryColor,
                        authLogoIconColor: brandingForm.primaryColor,
                      })}
                    >
                      Usar cor principal
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-[10px] text-xs font-extrabold"
                      onClick={() => setBrandingForm({
                        ...brandingForm,
                        logoBackgroundColor: brandingForm.secondaryColor,
                        authLogoBackgroundColor: brandingForm.secondaryColor,
                      })}
                    >
                      Usar fundo suave
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {[
                    {
                      title: "Painel",
                      description: "Menu lateral e navegação mobile",
                      iconField: "logoIconColor",
                      bgField: "logoBackgroundColor",
                      size: "large",
                    },
                    {
                      title: "Entrada",
                      description: "Tela de entrada e cadastro",
                      iconField: "authLogoIconColor",
                      bgField: "authLogoBackgroundColor",
                      size: "compact",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[18px] border border-[#CDEFE8] bg-[#fffdf7] p-4">
                      <div className="flex items-center justify-between gap-3 border-b border-[#efe6cd] pb-3">
                        <div>
                          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#6b7280]">{item.title}</p>
                          <p className="mt-0.5 text-xs font-semibold text-[#8a728d]">{item.description}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                          <Zap className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="mt-4 rounded-[16px] border border-[#CDEFE8] bg-white p-4">
                        <div className="flex min-h-[78px] items-center gap-4">
                          <span
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
                            style={{ background: brandingForm[item.bgField], color: brandingForm[item.iconField] }}
                          >
                            <Zap className="h-9 w-9" strokeWidth={2.5} />
                          </span>
                          <div className="min-w-0">
                            <p className={`${item.size === "large" ? "text-2xl" : "text-xl"} font-extrabold leading-tight text-[#111827]`}>
                              {brandingForm.appName}
                            </p>
                            <p
                              className={`${item.size === "large" ? "text-2xl" : "text-xl"} font-extrabold leading-tight`}
                              style={{ color: brandingForm[item.iconField] }}
                            >
                              {brandingForm.appSuffix}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                          [item.iconField, "Cor do ícone"],
                          [item.bgField, "Cor do fundo"],
                        ].map(([field, label]) => (
                          <div key={field} className="rounded-[14px] border border-[#CDEFE8] bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <Label className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#6b7280]">{label}</Label>
                              <span className="h-5 w-5 rounded-full border border-[#d9d3c5]" style={{ background: brandingForm[field] }} />
                            </div>
                            <div className="flex h-10 items-center gap-2 rounded-[10px] border border-[#CDEFE8] bg-[#fbfaf7] px-2">
                              <input
                                type="color"
                                value={brandingForm[field]}
                                onChange={(event) => setBrandingForm({ ...brandingForm, [field]: event.target.value })}
                                className="h-7 w-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
                                aria-label={label}
                              />
                              <Input
                                value={brandingForm[field]}
                                onChange={(event) => setBrandingForm({ ...brandingForm, [field]: event.target.value })}
                                className="h-8 border-0 bg-transparent px-1 font-mono text-sm shadow-none focus-visible:ring-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <LogoUpload
                  id="main-logo-upload"
                  label="Logo principal"
                  description="Usada na sidebar e nas telas internas. Prefira PNG ou SVG com fundo transparente."
                  value={brandingForm.logoDataUrl}
                  onChange={(event) => handleBrandingFile("logoDataUrl", event.target.files?.[0])}
                  onClear={() => setBrandingForm({ ...brandingForm, logoDataUrl: "" })}
                />
                <LogoUpload
                  id="compact-logo-upload"
                  label="Logo compacta"
                  description="Usada em ícones, menu mobile e elementos menores do produto."
                  value={brandingForm.compactLogoDataUrl}
                  onChange={(event) => handleBrandingFile("compactLogoDataUrl", event.target.files?.[0])}
                  onClear={() => setBrandingForm({ ...brandingForm, compactLogoDataUrl: "" })}
                />
                <LogoUpload
                  id="auth-logo-upload"
                  label="Logo do login"
                  description="Aparece nas telas de autenticação, mantendo a mesma identidade visual."
                  value={brandingForm.authLogoDataUrl}
                  onChange={(event) => handleBrandingFile("authLogoDataUrl", event.target.files?.[0])}
                  onClear={() => setBrandingForm({ ...brandingForm, authLogoDataUrl: "" })}
                />
              </div>

              <div className="mt-6 flex justify-end">
                <Button type="button" className="h-11 rounded-[12px] px-6 font-extrabold" onClick={saveBranding}>
                  <CheckCircle2 className="h-4 w-4" />
                  Salvar aparência
                </Button>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#0f1728]">
                <UserCircle className="h-5 w-5 text-primary" />
                Perfil administrador
              </h2>
              <p className="mt-1 text-sm font-medium text-[#5f6877]">
                Altere nome, dados profissionais e foto usada no topo do sistema.
              </p>

              <div className="mt-6 flex items-center gap-4 rounded-[18px] border border-[#CDEFE8] bg-[#F2FFFC] p-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-white text-xl font-extrabold text-primary">
                  {avatar ? <img src={avatar} alt="Foto de perfil" className="h-full w-full object-cover" /> : profileInitials(currentUser)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-extrabold text-[#111827]">{profileForm.full_name || currentUser?.email}</p>
                  <p className="truncate text-sm font-medium text-[#5f6877]">{currentUser?.email}</p>
                  <Label
                    htmlFor="admin-avatar-upload"
                    className="mt-3 inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Upload className="h-4 w-4" />
                    Trocar foto
                  </Label>
                  <input id="admin-avatar-upload" type="file" accept="image/*" className="hidden" onChange={(event) => handleAvatarFile(event.target.files?.[0])} />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={(event) => setProfileForm({ ...profileForm, full_name: event.target.value })}
                    className="mt-2 h-11 rounded-[10px]"
                  />
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Input
                    value={profileForm.company}
                    onChange={(event) => setProfileForm({ ...profileForm, company: event.target.value })}
                    className="mt-2 h-11 rounded-[10px]"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>CREA/CAU</Label>
                    <Input
                      value={profileForm.crea}
                      onChange={(event) => setProfileForm({ ...profileForm, crea: event.target.value })}
                      className="mt-2 h-11 rounded-[10px]"
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })}
                      className="mt-2 h-11 rounded-[10px]"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="button"
                className="mt-6 h-11 w-full rounded-[12px] font-extrabold"
                onClick={() => saveProfile()}
                disabled={saving === "profile"}
              >
                {saving === "profile" ? "Salvando..." : "Salvar perfil"}
              </Button>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#0f1728]">
                <BellRing className="h-5 w-5 text-primary" />
                Nova notificação
              </h2>
              <p className="mt-1 text-sm font-medium text-[#5f6877]">
                Crie avisos internos para orientar ações técnicas e administrativas.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={notificationForm.title}
                    onChange={(event) => setNotificationForm({ ...notificationForm, title: event.target.value })}
                    className="mt-2 h-11 rounded-[10px]"
                    placeholder="Ex.: Projeto aguardando revisão"
                  />
                </div>
                <div>
                  <Label>Mensagem</Label>
                  <Textarea
                    value={notificationForm.description}
                    onChange={(event) => setNotificationForm({ ...notificationForm, description: event.target.value })}
                    className="mt-2 min-h-[110px] rounded-[10px]"
                    placeholder="Detalhe o motivo do aviso e a ação esperada."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={notificationForm.tone} onValueChange={(value) => setNotificationForm({ ...notificationForm, tone: value })}>
                      <SelectTrigger className="mt-2 h-11 rounded-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Informação</SelectItem>
                        <SelectItem value="warning">Atenção</SelectItem>
                        <SelectItem value="success">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Input
                      value={notificationForm.category}
                      onChange={(event) => setNotificationForm({ ...notificationForm, category: event.target.value })}
                      className="mt-2 h-11 rounded-[10px]"
                    />
                  </div>
                  <div>
                    <Label>Destino</Label>
                    <Input
                      value={notificationForm.href}
                      onChange={(event) => setNotificationForm({ ...notificationForm, href: event.target.value })}
                      className="mt-2 h-11 rounded-[10px]"
                    />
                  </div>
                </div>
              </div>
              <Button type="button" className="mt-6 h-11 w-full rounded-[12px] font-extrabold" onClick={sendNotification}>
                <Send className="h-4 w-4" />
                Enviar notificação
              </Button>
            </section>

            <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0f1728]">Central de notificações</h2>
                  <p className="mt-1 text-sm font-medium text-[#5f6877]">
                    {unreadCount} pendente{unreadCount === 1 ? "" : "s"} de {notifications.length} aviso{notifications.length === 1 ? "" : "s"}.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="rounded-[10px]" onClick={markAllRead}>
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar lidas
                  </Button>
                  <Button type="button" variant="outline" className="rounded-[10px] text-red-600 hover:text-red-700" onClick={clearAll}>
                    <Trash2 className="h-4 w-4" />
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {notifications.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[#CDEFE8] bg-[#F2FFFC] p-8 text-center text-sm font-semibold text-[#687386]">
                    Nenhuma notificação cadastrada.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="rounded-[18px] border border-[#CDEFE8] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${item.read ? "bg-[#d1d5db]" : "bg-primary"}`} />
                            <p className="font-extrabold text-[#111827]">{item.title}</p>
                            <Badge variant="outline" className="rounded-[10px]">{item.category || "Sistema"}</Badge>
                          </div>
                          <p className="mt-2 text-sm font-medium leading-6 text-[#5f6877]">{item.description}</p>
                        </div>
                        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.08em] text-[#7a8495]">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col gap-4 rounded-[18px] border border-[#CDEFE8] bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate font-extrabold text-[#0f1728]">{u.full_name || u.email}</p>
                <p className="mt-1 truncate text-sm font-medium text-[#647084]">{u.email}</p>
                <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[#7a8495]">
                  {professionLabel(u.profession || u.profissao)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={u.plan || "gratuito"} onValueChange={(value) => updatePlan(u.id, value)}>
                  <SelectTrigger className="h-10 w-40 rounded-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gratuito">Gratuito</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="engenharia">Engenharia</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={u.profession || u.profissao || "projetista"}
                  onValueChange={(value) => updateProfession(u.id, value)}
                >
                  <SelectTrigger className="h-10 w-44 rounded-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROFESSIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {u.role === "admin" && <Badge className="rounded-[10px]">Admin</Badge>}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="projects" className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="flex flex-col gap-4 rounded-[18px] border border-[#CDEFE8] bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate font-extrabold text-[#0f1728]">{p.name}</p>
                <p className="mt-1 truncate text-sm font-medium text-[#647084]">
                  {p.client_name || "Sem cliente"} • {p.created_by || "sem responsável"}
                </p>
              </div>
              <Badge variant="outline" className="w-fit rounded-[10px] px-3 py-1">{p.status || "Rascunho"}</Badge>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
