import { useState, useMemo } from "react";
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
  Layers,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Zap,
  Info,
  Maximize2,
  Tag,
  Factory,
  Search,
} from "lucide-react";
import {
  MODULE_CATALOG,
  getAllModulePresets,
  saveStoredCustomModule,
  deleteStoredCustomModule,
} from "@/lib/solarDesignerGeometry";

export default function CustomModuleModal({
  open,
  onOpenChange,
  currentPresetId,
  onSelectModulePreset,
  onCustomModulesChanged,
}) {
  const [tab, setTab] = useState("catalog"); // "catalog" | "new"
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");

  // Formulário de novo módulo
  const [formData, setFormData] = useState({
    manufacturer: "",
    model: "",
    wp: 580,
    widthMm: 1134,
    heightMm: 2278,
    technology: "TOPCon N-Type",
    vmpV: 42.5,
    impA: 13.65,
    vocV: 51.2,
    iscA: 14.4,
    efficiencyPct: 22.5,
  });

  const [formError, setFormError] = useState("");

  const allModules = useMemo(() => {
    return getAllModulePresets();
  }, [open, tab]);

  const brands = useMemo(() => {
    const set = new Set();
    allModules.forEach((m) => {
      if (m.manufacturer) set.add(m.manufacturer);
    });
    return ["all", ...Array.from(set)];
  }, [allModules]);

  const filteredModules = useMemo(() => {
    return allModules.filter((m) => {
      const matchBrand = filterBrand === "all" || m.manufacturer === filterBrand;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.model?.toLowerCase().includes(q) ||
        m.manufacturer?.toLowerCase().includes(q) ||
        m.fullTitle?.toLowerCase().includes(q) ||
        String(m.wp).includes(q);
      return matchBrand && matchSearch;
    });
  }, [allModules, filterBrand, searchTerm]);

  // Proporção calculada em tempo real para o formulário
  const calcRatio = useMemo(() => {
    const w = Number(formData.widthMm) || 1;
    const h = Number(formData.heightMm) || 1;
    return (Math.max(w, h) / Math.min(w, h)).toFixed(2);
  }, [formData.widthMm, formData.heightMm]);

  const handleApplyPresetTemplate = (templateType) => {
    if (templateType === "550-perc") {
      setFormData({
        manufacturer: "Padrão Tier-1",
        model: "Mono Half-Cell 550W",
        wp: 550,
        widthMm: 1134,
        heightMm: 2278,
        technology: "Mono PERC",
        vmpV: 41.5,
        impA: 13.25,
        vocV: 49.8,
        iscA: 14.1,
        efficiencyPct: 21.3,
      });
    } else if (templateType === "580-topcon") {
      setFormData({
        manufacturer: "Top Tier-1",
        model: "TOPCon N-Type 580W",
        wp: 580,
        widthMm: 1134,
        heightMm: 2278,
        technology: "TOPCon N-Type",
        vmpV: 42.6,
        impA: 13.62,
        vocV: 51.1,
        iscA: 14.36,
        efficiencyPct: 22.5,
      });
    } else if (templateType === "670-vertex") {
      setFormData({
        manufacturer: "Ultra High Power",
        model: "Vertex G12 670W",
        wp: 670,
        widthMm: 1303,
        heightMm: 2384,
        technology: "Mono PERC Bifacial",
        vmpV: 38.2,
        impA: 17.55,
        vocV: 45.9,
        iscA: 18.62,
        efficiencyPct: 21.6,
      });
    }
    setFormError("");
  };

  const handleCreateCustomModule = (e) => {
    e.preventDefault();
    if (!formData.model.trim()) {
      setFormError("Informe o modelo comercial do painel.");
      return;
    }
    const wp = Number(formData.wp);
    if (!wp || wp < 200 || wp > 1000) {
      setFormError("A potência do módulo deve estar entre 200W e 1000W.");
      return;
    }
    const widthM = (Number(formData.widthMm) || 1134) / 1000;
    const heightM = (Number(formData.heightMm) || 2278) / 1000;

    if (widthM < 0.8 || widthM > 1.6 || heightM < 1.5 || heightM > 2.8) {
      setFormError("Dimensões fora do padrão comercial usual (Largura: 0.8m a 1.6m, Comprimento: 1.5m a 2.8m).");
      return;
    }

    const newModule = saveStoredCustomModule({
      manufacturer: formData.manufacturer.trim() || "Personalizado",
      model: formData.model.trim(),
      wp,
      widthM: Number(widthM.toFixed(3)),
      heightM: Number(heightM.toFixed(3)),
      technology: formData.technology,
      vmpV: Number(formData.vmpV) || 42.0,
      impA: Number(formData.impA) || 13.5,
      vocV: Number(formData.vocV) || 50.0,
      iscA: Number(formData.iscA) || 14.2,
      efficiencyPct: Number(formData.efficiencyPct) || 22.0,
    });

    onCustomModulesChanged?.();
    onSelectModulePreset?.(newModule.id);
    setTab("catalog");
    onOpenChange?.(false);
  };

  const handleDeleteModule = (id) => {
    deleteStoredCustomModule(id);
    onCustomModulesChanged?.();
    if (currentPresetId === id) {
      onSelectModulePreset?.(MODULE_CATALOG[0].id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 border border-slate-200 bg-white shadow-2xl rounded-xl">
        {/* Header Elegante */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-[#00d8b8]/15 border border-[#00d8b8]/30 flex items-center justify-center text-[#009b84]">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Modelos de Módulos Fotovoltaicos
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {allModules.length} disponíveis
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Selecione módulos comerciais Tier-1 ou cadastre placas personalizadas com suas dimensões exatas.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Abas Superiores */}
          <div className="flex items-center gap-2 mt-3 pt-2">
            <button
              type="button"
              onClick={() => setTab("catalog")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                tab === "catalog"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Factory className="h-3.5 w-3.5 text-[#009b84]" /> Catálogo & Personalizados
            </button>
            <button
              type="button"
              onClick={() => setTab("new")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                tab === "new"
                  ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Plus className="h-3.5 w-3.5" /> + Cadastrar Novo Módulo
            </button>
          </div>
        </DialogHeader>

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "catalog" ? (
            <div className="space-y-4">
              {/* Barra de Busca e Filtro de Fabricante */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por modelo, fabricante ou potência (ex: 580W, Jinko, Tiger)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs border-slate-200 focus:border-[#00d8b8]"
                  />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {brands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setFilterBrand(b)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap transition ${
                        filterBrand === b
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {b === "all" ? "Todas as marcas" : b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid de Cartões de Módulos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredModules.map((mod) => {
                  const isCurrent = currentPresetId === mod.id || currentPresetId === mod.model;
                  const isCustom = Boolean(mod.isCustom);
                  return (
                    <div
                      key={mod.id}
                      className={`relative rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                        isCurrent
                          ? "border-[#00d8b8] bg-[#E6FAF7]/40 shadow-sm ring-1 ring-[#00d8b8]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                              {mod.manufacturer || "Tier-1"}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 leading-tight">
                              {mod.model}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[#00d8b8]/20 text-[#009b84]">
                              {mod.wp} Wp
                            </span>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteModule(mod.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Excluir módulo personalizado"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Specs Principais */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 my-2 text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-slate-600 font-medium">Dimensões:</span>{" "}
                            <span className="font-bold text-slate-800">
                              {(mod.widthM * 1000).toFixed(0)} × {(mod.heightM * 1000).toFixed(0)} mm
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600 font-medium">Tecnologia:</span>{" "}
                            <span className="font-bold text-slate-800">{mod.technology || "N-Type"}</span>
                          </div>
                          <div>
                            <span className="text-slate-600 font-medium">Vmp / Imp:</span>{" "}
                            <span className="font-bold text-slate-800">
                              {mod.vmpV?.toFixed(1) || "-"}V / {mod.impA?.toFixed(1) || "-"}A
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600 font-medium">Voc / Isc:</span>{" "}
                            <span className="font-bold text-slate-800">
                              {mod.vocV?.toFixed(1) || "-"}V / {mod.iscA?.toFixed(1) || "-"}A
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botão de Ação */}
                      <div className="pt-2 flex items-center justify-between border-t border-slate-100 mt-1">
                        <span className="text-[10px] text-slate-600">
                          Área útil: {(mod.widthM * mod.heightM).toFixed(2)} m²
                        </span>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-[#009b84]">
                            <Check className="h-3.5 w-3.5" /> Módulo Ativo
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              onSelectModulePreset?.(mod.id);
                              onOpenChange?.(false);
                            }}
                            className="h-7 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
                          >
                            Usar Este Modelo
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Formulário de Cadastro de Módulo Personalizado */
            <form onSubmit={handleCreateCustomModule} className="space-y-4 max-w-xl mx-auto">
              {/* Templates Rápidos */}
              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#009b84]" /> Preencher com Modelo Base Típico:
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTemplate("550-perc")}
                    className="p-2 rounded-lg border border-slate-200 hover:border-[#00d8b8] bg-slate-50 hover:bg-[#E6FAF7]/30 text-left transition"
                  >
                    <div className="text-xs font-black text-slate-800">Padrão 550W</div>
                    <div className="text-[10px] text-slate-500">Mono PERC (2278×1134)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTemplate("580-topcon")}
                    className="p-2 rounded-lg border border-slate-200 hover:border-[#00d8b8] bg-slate-50 hover:bg-[#E6FAF7]/30 text-left transition"
                  >
                    <div className="text-xs font-black text-slate-800">TopCon 580W</div>
                    <div className="text-[10px] text-slate-500">N-Type (2278×1134)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTemplate("670-vertex")}
                    className="p-2 rounded-lg border border-slate-200 hover:border-[#00d8b8] bg-slate-50 hover:bg-[#E6FAF7]/30 text-left transition"
                  >
                    <div className="text-xs font-black text-slate-800">Vertex 670W</div>
                    <div className="text-[10px] text-slate-500">G12 Extra (2384×1303)</div>
                  </button>
                </div>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Fabricante</Label>
                  <Input
                    placeholder="Ex: Canadian, Jinko, Sunova, Deye..."
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700">
                    Modelo Comercial <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ex: CS6W-580MS ou JKM580N-72HL4"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="h-8 text-xs mt-1 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Potência (Wp)</Label>
                  <Input
                    type="number"
                    min="200"
                    max="900"
                    step="5"
                    value={formData.wp}
                    onChange={(e) => setFormData({ ...formData, wp: Number(e.target.value) })}
                    className="h-8 text-xs mt-1 font-black text-[#009b84]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700">Largura (mm)</Label>
                  <Input
                    type="number"
                    min="800"
                    max="1500"
                    step="1"
                    value={formData.widthMm}
                    onChange={(e) => setFormData({ ...formData, widthMm: Number(e.target.value) })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700">Comprimento (mm)</Label>
                  <Input
                    type="number"
                    min="1500"
                    max="2700"
                    step="1"
                    value={formData.heightMm}
                    onChange={(e) => setFormData({ ...formData, heightMm: Number(e.target.value) })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              {/* Indicador de Proporção Comercial */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500">Proporção física calculada:</span>
                <span className="font-bold text-slate-800">
                  1:{calcRatio}{" "}
                  {calcRatio >= 1.7 && calcRatio <= 2.2 ? (
                    <span className="text-emerald-800 text-[11px] font-black">✓ Padrão Comercial Ideal</span>
                  ) : (
                    <span className="text-amber-700 text-[11px] font-black">⚠ Fora do padrão típico (~1:2)</span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Vmp (V)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.vmpV}
                    onChange={(e) => setFormData({ ...formData, vmpV: Number(e.target.value) })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Imp (A)</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={formData.impA}
                    onChange={(e) => setFormData({ ...formData, impA: Number(e.target.value) })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Voc (V)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.vocV}
                    onChange={(e) => setFormData({ ...formData, vocV: Number(e.target.value) })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Isc (A)</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={formData.iscA}
                    onChange={(e) => setFormData({ ...formData, iscA: Number(e.target.value) })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTab("catalog")}
                  className="h-8 text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="h-8 text-xs font-black bg-[#00d8b8] hover:bg-[#00c4a7] text-slate-950 shadow-sm"
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Salvar e Usar no Projeto
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
