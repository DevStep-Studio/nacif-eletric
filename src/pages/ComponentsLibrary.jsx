import { useState } from "react";
import { Search, Cpu, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";

// ─── Catálogo WEG real ────────────────────────────────────────────────────────
const WEG_CATALOG = [
  // Disjuntores Caixa Moldada série DWS / MDW
  { code: "10066897", name: "Disjuntor Monopolar 6A Curva B", type: "Disjuntor", model: "DWS-C6-1", poles: 1, current: 6, curve: "B", icu: 10, dins: 1, voltage: 240, price: 16.90 },
  { code: "10066898", name: "Disjuntor Monopolar 10A Curva B", type: "Disjuntor", model: "DWS-B10-1", poles: 1, current: 10, curve: "B", icu: 10, dins: 1, voltage: 240, price: 18.50 },
  { code: "10066899", name: "Disjuntor Monopolar 10A Curva C", type: "Disjuntor", model: "DWS-C10-1", poles: 1, current: 10, curve: "C", icu: 10, dins: 1, voltage: 240, price: 18.50 },
  { code: "10066900", name: "Disjuntor Monopolar 16A Curva C", type: "Disjuntor", model: "DWS-C16-1", poles: 1, current: 16, curve: "C", icu: 10, dins: 1, voltage: 240, price: 19.90 },
  { code: "10066901", name: "Disjuntor Monopolar 20A Curva C", type: "Disjuntor", model: "DWS-C20-1", poles: 1, current: 20, curve: "C", icu: 10, dins: 1, voltage: 240, price: 20.50 },
  { code: "10066902", name: "Disjuntor Monopolar 25A Curva C", type: "Disjuntor", model: "DWS-C25-1", poles: 1, current: 25, curve: "C", icu: 10, dins: 1, voltage: 240, price: 22.90 },
  { code: "10066903", name: "Disjuntor Monopolar 32A Curva C", type: "Disjuntor", model: "DWS-C32-1", poles: 1, current: 32, curve: "C", icu: 10, dins: 1, voltage: 240, price: 25.90 },
  { code: "10066910", name: "Disjuntor Bipolar 20A Curva C", type: "Disjuntor", model: "DWS-C20-2", poles: 2, current: 20, curve: "C", icu: 10, dins: 2, voltage: 240, price: 38.90 },
  { code: "10066911", name: "Disjuntor Bipolar 25A Curva C", type: "Disjuntor", model: "DWS-C25-2", poles: 2, current: 25, curve: "C", icu: 10, dins: 2, voltage: 240, price: 42.90 },
  { code: "10066912", name: "Disjuntor Bipolar 32A Curva C", type: "Disjuntor", model: "DWS-C32-2", poles: 2, current: 32, curve: "C", icu: 10, dins: 2, voltage: 240, price: 48.90 },
  { code: "10066920", name: "Disjuntor Bipolar 40A Curva C", type: "Disjuntor", model: "DWS-C40-2", poles: 2, current: 40, curve: "C", icu: 10, dins: 2, voltage: 240, price: 55.90 },
  { code: "10066930", name: "Disjuntor Tripolar 25A Curva C", type: "Disjuntor", model: "DWS-C25-3", poles: 3, current: 25, curve: "C", icu: 10, dins: 3, voltage: 380, price: 68.90 },
  { code: "10066931", name: "Disjuntor Tripolar 40A Curva C", type: "Disjuntor", model: "DWS-C40-3", poles: 3, current: 40, curve: "C", icu: 10, dins: 3, voltage: 380, price: 78.90 },
  { code: "10066932", name: "Disjuntor Tripolar 63A Curva C", type: "Disjuntor", model: "DWS-C63-3", poles: 3, current: 63, curve: "C", icu: 25, dins: 3, voltage: 380, price: 95.90 },
  { code: "10066933", name: "Disjuntor Tripolar 100A Curva C", type: "Disjuntor", model: "MDW-C100-3", poles: 3, current: 100, curve: "C", icu: 25, dins: 4, voltage: 380, price: 185.00 },
  { code: "10066940", name: "Disjuntor Tetrapolar 40A Curva C", type: "Disjuntor", model: "DWS-C40-4", poles: 4, current: 40, curve: "C", icu: 10, dins: 4, voltage: 380, price: 92.90 },
  { code: "10066941", name: "Disjuntor Tetrapolar 63A Curva C", type: "Disjuntor", model: "DWS-C63-4", poles: 4, current: 63, curve: "C", icu: 25, dins: 4, voltage: 380, price: 125.00 },

  // DR — Interruptores Diferenciais Residuais WEG
  { code: "10071000", name: "DR Bipolar 25A 30mA Tipo AC", type: "DR", model: "DR-iC60-2P-25A-30mA", poles: 2, current: 25, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 115.00 },
  { code: "10071001", name: "DR Bipolar 40A 30mA Tipo AC", type: "DR", model: "DR-iC60-2P-40A-30mA", poles: 2, current: 40, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 130.00 },
  { code: "10071002", name: "DR Bipolar 63A 30mA Tipo AC", type: "DR", model: "DR-iC60-2P-63A-30mA", poles: 2, current: 63, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 155.00 },
  { code: "10071010", name: "DR Tetrapolar 25A 30mA Tipo AC", type: "DR", model: "DR-iC60-4P-25A-30mA", poles: 4, current: 25, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 245.00 },
  { code: "10071011", name: "DR Tetrapolar 40A 30mA Tipo AC", type: "DR", model: "DR-iC60-4P-40A-30mA", poles: 4, current: 40, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 275.00 },
  { code: "10071012", name: "DR Tetrapolar 63A 30mA Tipo AC", type: "DR", model: "DR-iC60-4P-63A-30mA", poles: 4, current: 63, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 320.00 },
  { code: "10071020", name: "DDR Bipolar 25A 30mA (DJ+DR)", type: "DR", model: "DDR-iC60N-2P-25A", poles: 2, current: 25, sensitivity: 30, icu: 10, dins: 2, voltage: 240, price: 225.00 },

  // DPS — Dispositivos de Proteção contra Surtos WEG
  { code: "10082000", name: "DPS Classe II Monofásico 275V 20kA", type: "DPS", model: "DPS-IIDC-275V-20kA-1P", poles: 1, voltage: 275, icu: 20, dins: 1, price: 75.00 },
  { code: "10082001", name: "DPS Classe II Bifásico 275V 20kA", type: "DPS", model: "DPS-IIDC-275V-20kA-2P", poles: 2, voltage: 275, icu: 20, dins: 2, price: 140.00 },
  { code: "10082002", name: "DPS Classe II Trifásico 275V 20kA", type: "DPS", model: "DPS-IIDC-275V-20kA-3P+N", poles: 4, voltage: 275, icu: 20, dins: 4, price: 265.00 },
  { code: "10082010", name: "DPS Classe I+II 255V 50kA", type: "DPS", model: "DPS-I+II-255V-50kA", poles: 3, voltage: 255, icu: 50, dins: 4, price: 420.00 },

  // Contatores WEG série CWB
  { code: "10040061", name: "Contator Tripolar 9A 220V 60Hz CWB9", type: "Contator", model: "CWB9-10-30C20", poles: 3, current: 9, dins: 2, voltage: 220, price: 68.00 },
  { code: "10040062", name: "Contator Tripolar 12A 220V CWB12", type: "Contator", model: "CWB12-10-30C20", poles: 3, current: 12, dins: 2, voltage: 220, price: 82.00 },
  { code: "10040063", name: "Contator Tripolar 16A 220V CWB16", type: "Contator", model: "CWB16-10-30C20", poles: 3, current: 16, dins: 2, voltage: 220, price: 95.00 },
  { code: "10040064", name: "Contator Tripolar 25A 220V CWB25", type: "Contator", model: "CWB25-10-30C20", poles: 3, current: 25, dins: 3, voltage: 220, price: 115.00 },
  { code: "10040065", name: "Contator Tripolar 40A 220V CWB40", type: "Contator", model: "CWB40-10-30C20", poles: 3, current: 40, dins: 4, voltage: 220, price: 148.00 },

  // Relés de Sobrecarga WEG RW
  { code: "10031001", name: "Relé de Sobrecarga 4–6,3A RW27D", type: "Relé", model: "RW27D-1D3-U005", current: "4–6,3", dins: 1, voltage: 690, price: 45.00 },
  { code: "10031002", name: "Relé de Sobrecarga 6–10A RW27D", type: "Relé", model: "RW27D-1D3-U007", current: "6–10", dins: 1, voltage: 690, price: 48.00 },
  { code: "10031003", name: "Relé de Sobrecarga 9–14A RW27D", type: "Relé", model: "RW27D-1D3-U012", current: "9–14", dins: 1, voltage: 690, price: 52.00 },
  { code: "10031004", name: "Relé de Sobrecarga 12–20A RW27D", type: "Relé", model: "RW27D-1D3-U016", current: "12–20", dins: 1, voltage: 690, price: 58.00 },

  // Quadros WEG QDF
  { code: "10016010", name: "Quadro de Distribuição 12 DIN Embutir", type: "Quadro", model: "QDF-12-E", dins: 12, voltage: 440, price: 68.00 },
  { code: "10016012", name: "Quadro de Distribuição 18 DIN Embutir", type: "Quadro", model: "QDF-18-E", dins: 18, voltage: 440, price: 88.00 },
  { code: "10016014", name: "Quadro de Distribuição 24 DIN Embutir", type: "Quadro", model: "QDF-24-E", dins: 24, voltage: 440, price: 115.00 },
  { code: "10016020", name: "Quadro de Distribuição 36 DIN Embutir", type: "Quadro", model: "QDF-36-E", dins: 36, voltage: 440, price: 148.00 },
  { code: "10016030", name: "Quadro de Distribuição 48 DIN Embutir", type: "Quadro", model: "QDF-48-E", dins: 48, voltage: 440, price: 185.00 },
  { code: "10016040", name: "Quadro de Distribuição 24 DIN Sobrepor", type: "Quadro", model: "QDF-24-S", dins: 24, voltage: 440, price: 125.00 },

  // Barramentos WEG
  { code: "10090001", name: "Barramento de Fase 1P 125A", type: "Barramento", model: "BTF-125A-1P-6P", poles: 1, current: 125, price: 28.00, dins: 0 },
  { code: "10090002", name: "Barramento de Fase 1P 250A", type: "Barramento", model: "BTF-250A-1P-6P", poles: 1, current: 250, price: 45.00, dins: 0 },
  { code: "10090010", name: "Barramento de Neutro/Terra 12 Bornes", type: "Barramento", model: "BTN-12", current: 125, price: 22.00, dins: 1 },
  { code: "10090011", name: "Barramento de Neutro/Terra 24 Bornes", type: "Barramento", model: "BTN-24", current: 125, price: 35.00, dins: 1 },
];

const TYPES = ["Todos", "Disjuntor", "DR", "DPS", "Contator", "Relé", "Quadro", "Barramento"];

const TYPE_COLORS = {
  Disjuntor: "bg-primary/15 text-primary border-primary/30",
  DR: "bg-primary/15 text-primary border-primary/30",
  DPS: "bg-primary/15 text-primary border-primary/30",
  Contator: "bg-primary/15 text-primary border-primary/30",
  Relé: "bg-primary/15 text-primary border-primary/30",
  Quadro: "bg-primary/15 text-primary border-primary/30",
  Barramento: "bg-primary/15 text-primary border-primary/30",
};

export default function ComponentsLibrary() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Todos");

  const filtered = WEG_CATALOG.filter(c =>
    (tab === "Todos" || c.type === tab) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
     c.model.toLowerCase().includes(search.toLowerCase()) ||
     c.code.includes(search))
  );

  return (
    <div className="w-full max-w-none space-y-5 pb-20">
      <PageHeader
        icon={Cpu}
        title="Catálogo WEG"
        subtitle="Biblioteca técnica, modelos reais e referência de componentes para projeto."
        actions={
          <Badge className="bg-primary/15 text-primary border border-primary/30 font-bold">
            <Zap className="w-3 h-3 mr-1" />WEG — Padrão NBR 5410
          </Badge>
        }
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, modelo ou código WEG..."
            className="h-12 rounded-[14px] border-[#BCEEE5] bg-white pl-11 text-sm font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {TYPES.map(t => <TabsTrigger key={t} value={t} className="text-xs">{t}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum componente encontrado</div>
        )}
        {filtered.map((c, i) => (
          <div key={i} className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{c.name}</span>
                  <Badge className={`text-[10px] border ${TYPE_COLORS[c.type] || ""}`}>{c.type}</Badge>
                </div>
                <div className="flex gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                  <span className="font-mono text-primary">{c.model}</span>
                  <span>Cód: <span className="text-foreground">{c.code}</span></span>
                  {c.poles && <span>{c.poles}P</span>}
                  {c.current && typeof c.current === "number" && <span>{c.current}A</span>}
                  {c.current && typeof c.current === "string" && <span>{c.current}A</span>}
                  {c.voltage && <span>{c.voltage}V</span>}
                  {c.curve && <span>Curva {c.curve}</span>}
                  {c.icu && <span>Icu {c.icu}kA</span>}
                  {c.sensitivity && <span>In {c.sensitivity}mA</span>}
                  {c.dins > 0 && <span>{c.dins} DIN</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-primary text-sm">R$ {c.price.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">WEG · {c.type}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        {filtered.length} de {WEG_CATALOG.length} componentes · Fabricante exclusivo: WEG S.A.
      </p>
    </div>
  );
}
