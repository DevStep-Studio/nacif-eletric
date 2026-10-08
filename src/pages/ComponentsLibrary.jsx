import { useState } from "react";
import { Search, Cpu, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";

// ─── Catálogo WEG Técnico e Comercial Atualizado ──────────────────────────────
const WEG_CATALOG = [
  // Disjuntores Caixa Moldada Industriais — Linha WEG DWP / DWS / AGW (IEC 60947-2)
  { code: "10068001", name: "Disjuntor Caixa Moldada 630A 3P 50kA", type: "Disjuntor", model: "DWP630L-50-3", poles: 3, current: 630, curve: "C", icu: 50, dins: 0, voltage: 690, price: 3200.00 },
  { code: "10068002", name: "Disjuntor Caixa Moldada 800A 3P 65kA", type: "Disjuntor", model: "DWP800L-65-3", poles: 3, current: 800, curve: "C", icu: 65, dins: 0, voltage: 690, price: 5400.00 },
  { code: "10068003", name: "Disjuntor Caixa Moldada 400A 3P 35kA", type: "Disjuntor", model: "DWP400L-35-3", poles: 3, current: 400, curve: "C", icu: 35, dins: 0, voltage: 690, price: 1950.00 },
  { code: "10068004", name: "Disjuntor Caixa Moldada 250A 3P 35kA", type: "Disjuntor", model: "DWP250L-35-3", poles: 3, current: 250, curve: "C", icu: 35, dins: 0, voltage: 690, price: 1150.00 },
  { code: "10068005", name: "Disjuntor Caixa Moldada 200A 3P 25kA", type: "Disjuntor", model: "DWP200L-25-3", poles: 3, current: 200, curve: "C", icu: 25, dins: 0, voltage: 690, price: 890.00 },
  { code: "10068006", name: "Disjuntor Caixa Moldada 160A 3P 25kA", type: "Disjuntor", model: "DWP160L-25-3", poles: 3, current: 160, curve: "C", icu: 25, dins: 0, voltage: 690, price: 740.00 },
  { code: "10068007", name: "Disjuntor Caixa Moldada 125A 3P 25kA", type: "Disjuntor", model: "DWP125L-25-3", poles: 3, current: 125, curve: "C", icu: 25, dins: 0, voltage: 690, price: 560.00 },
  { code: "10068008", name: "Disjuntor Caixa Moldada 100A 3P 25kA", type: "Disjuntor", model: "DWP100L-25-3", poles: 3, current: 100, curve: "C", icu: 25, dins: 0, voltage: 690, price: 480.00 },
  { code: "10068009", name: "Disjuntor Caixa Moldada 250A 4P 35kA", type: "Disjuntor", model: "DWP250L-35-4", poles: 4, current: 250, curve: "C", icu: 35, dins: 0, voltage: 690, price: 1580.00 },
  { code: "10068010", name: "Disjuntor Caixa Moldada 400A 4P 50kA", type: "Disjuntor", model: "DWP400L-50-4", poles: 4, current: 400, curve: "C", icu: 50, dins: 0, voltage: 690, price: 2650.00 },
  { code: "10068011", name: "Disjuntor Caixa Moldada 630A 4P 50kA", type: "Disjuntor", model: "DWP630L-50-4", poles: 4, current: 630, curve: "C", icu: 50, dins: 0, voltage: 690, price: 4300.00 },

  // Mini-Disjuntores DIN — Linha WEG MDW (NBR NM 60898)
  { code: "10066897", name: "Disjuntor Monopolar 6A Curva B", type: "Disjuntor", model: "MDW-B6-1", poles: 1, current: 6, curve: "B", icu: 5, dins: 1, voltage: 240, price: 19.90 },
  { code: "10066898", name: "Disjuntor Monopolar 10A Curva B", type: "Disjuntor", model: "MDW-B10-1", poles: 1, current: 10, curve: "B", icu: 5, dins: 1, voltage: 240, price: 19.90 },
  { code: "10066899", name: "Disjuntor Monopolar 10A Curva C", type: "Disjuntor", model: "MDW-C10-1", poles: 1, current: 10, curve: "C", icu: 5, dins: 1, voltage: 240, price: 19.90 },
  { code: "10066900", name: "Disjuntor Monopolar 16A Curva C", type: "Disjuntor", model: "MDW-C16-1", poles: 1, current: 16, curve: "C", icu: 5, dins: 1, voltage: 240, price: 19.90 },
  { code: "10066901", name: "Disjuntor Monopolar 20A Curva C", type: "Disjuntor", model: "MDW-C20-1", poles: 1, current: 20, curve: "C", icu: 5, dins: 1, voltage: 240, price: 19.90 },
  { code: "10066902", name: "Disjuntor Monopolar 25A Curva C", type: "Disjuntor", model: "MDW-C25-1", poles: 1, current: 25, curve: "C", icu: 5, dins: 1, voltage: 240, price: 22.90 },
  { code: "10066903", name: "Disjuntor Monopolar 32A Curva C", type: "Disjuntor", model: "MDW-C32-1", poles: 1, current: 32, curve: "C", icu: 5, dins: 1, voltage: 240, price: 24.90 },
  { code: "10066904", name: "Disjuntor Monopolar 40A Curva C", type: "Disjuntor", model: "MDW-C40-1", poles: 1, current: 40, curve: "C", icu: 5, dins: 1, voltage: 240, price: 29.90 },
  { code: "10066905", name: "Disjuntor Monopolar 50A Curva C", type: "Disjuntor", model: "MDW-C50-1", poles: 1, current: 50, curve: "C", icu: 5, dins: 1, voltage: 240, price: 36.00 },
  { code: "10066906", name: "Disjuntor Monopolar 63A Curva C", type: "Disjuntor", model: "MDW-C63-1", poles: 1, current: 63, curve: "C", icu: 5, dins: 1, voltage: 240, price: 42.00 },
  { code: "10066910", name: "Disjuntor Bipolar 20A Curva C", type: "Disjuntor", model: "MDW-C20-2", poles: 2, current: 20, curve: "C", icu: 5, dins: 2, voltage: 240, price: 48.00 },
  { code: "10066911", name: "Disjuntor Bipolar 25A Curva C", type: "Disjuntor", model: "MDW-C25-2", poles: 2, current: 25, curve: "C", icu: 5, dins: 2, voltage: 240, price: 48.00 },
  { code: "10066912", name: "Disjuntor Bipolar 32A Curva C", type: "Disjuntor", model: "MDW-C32-2", poles: 2, current: 32, curve: "C", icu: 5, dins: 2, voltage: 240, price: 54.00 },
  { code: "10066920", name: "Disjuntor Bipolar 40A Curva C", type: "Disjuntor", model: "MDW-C40-2", poles: 2, current: 40, curve: "C", icu: 5, dins: 2, voltage: 240, price: 66.50 },
  { code: "10066921", name: "Disjuntor Bipolar 50A Curva C", type: "Disjuntor", model: "MDW-C50-2", poles: 2, current: 50, curve: "C", icu: 5, dins: 2, voltage: 240, price: 78.00 },
  { code: "10066922", name: "Disjuntor Bipolar 63A Curva C", type: "Disjuntor", model: "MDW-C63-2", poles: 2, current: 63, curve: "C", icu: 5, dins: 2, voltage: 240, price: 89.00 },
  { code: "10066930", name: "Disjuntor Tripolar 25A Curva C", type: "Disjuntor", model: "MDW-C25-3", poles: 3, current: 25, curve: "C", icu: 5, dins: 3, voltage: 380, price: 78.00 },
  { code: "10066931", name: "Disjuntor Tripolar 40A Curva C", type: "Disjuntor", model: "MDW-C40-3", poles: 3, current: 40, curve: "C", icu: 5, dins: 3, voltage: 380, price: 98.00 },
  { code: "10066932", name: "Disjuntor Tripolar 63A Curva C", type: "Disjuntor", model: "MDW-C63-3", poles: 3, current: 63, curve: "C", icu: 5, dins: 3, voltage: 380, price: 138.00 },
  { code: "10066933", name: "Disjuntor Tripolar 80A Curva C", type: "Disjuntor", model: "MDW-C80-3", poles: 3, current: 80, curve: "C", icu: 10, dins: 3, voltage: 380, price: 260.00 },
  { code: "10066934", name: "Disjuntor Tripolar 100A Curva C (DIN)", type: "Disjuntor", model: "MDW-C100-3", poles: 3, current: 100, curve: "C", icu: 10, dins: 4.5, voltage: 380, price: 340.00 },
  { code: "10066935", name: "Disjuntor Tripolar 125A Curva C (DIN)", type: "Disjuntor", model: "MDW-C125-3", poles: 3, current: 125, curve: "C", icu: 10, dins: 4.5, voltage: 380, price: 420.00 },
  { code: "10066940", name: "Disjuntor Tetrapolar 40A Curva C", type: "Disjuntor", model: "MDW-C40-4", poles: 4, current: 40, curve: "C", icu: 5, dins: 4, voltage: 380, price: 145.00 },
  { code: "10066941", name: "Disjuntor Tetrapolar 63A Curva C", type: "Disjuntor", model: "MDW-C63-4", poles: 4, current: 63, curve: "C", icu: 5, dins: 4, voltage: 380, price: 198.00 },

  // DR — Interruptores e Módulos Diferenciais Residuais WEG (NBR NM 61008-1)
  { code: "10071000", name: "DR Bipolar 25A 30mA Tipo AC", type: "DR", model: "RDW-2P-25A-30mA", poles: 2, current: 25, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 135.00 },
  { code: "10071001", name: "DR Bipolar 40A 30mA Tipo AC", type: "DR", model: "RDW-2P-40A-30mA", poles: 2, current: 40, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 155.00 },
  { code: "10071002", name: "DR Bipolar 63A 30mA Tipo AC", type: "DR", model: "RDW-2P-63A-30mA", poles: 2, current: 63, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 185.00 },
  { code: "10071003", name: "DR Bipolar 80A 30mA Tipo AC", type: "DR", model: "RDW-2P-80A-30mA", poles: 2, current: 80, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 260.00 },
  { code: "10071004", name: "DR Bipolar 100A 30mA Tipo AC", type: "DR", model: "RDW-2P-100A-30mA", poles: 2, current: 100, sensitivity: 30, icu: 6, dins: 2, voltage: 240, price: 340.00 },
  { code: "10071010", name: "DR Tetrapolar 25A 30mA Tipo AC", type: "DR", model: "RDW-4P-25A-30mA", poles: 4, current: 25, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 245.00 },
  { code: "10071011", name: "DR Tetrapolar 40A 30mA Tipo AC", type: "DR", model: "RDW-4P-40A-30mA", poles: 4, current: 40, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 275.00 },
  { code: "10071012", name: "DR Tetrapolar 63A 30mA Tipo AC", type: "DR", model: "RDW-4P-63A-30mA", poles: 4, current: 63, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 320.00 },
  { code: "10071013", name: "DR Tetrapolar 80A 30mA Tipo AC", type: "DR", model: "RDW-4P-80A-30mA", poles: 4, current: 80, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 460.00 },
  { code: "10071014", name: "DR Tetrapolar 100A 30mA Tipo AC", type: "DR", model: "RDW-4P-100A-30mA", poles: 4, current: 100, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 580.00 },
  { code: "10071015", name: "DR Tetrapolar 125A 30mA Tipo AC", type: "DR", model: "RDW-4P-125A-30mA", poles: 4, current: 125, sensitivity: 30, icu: 6, dins: 4, voltage: 380, price: 780.00 },
  { code: "10071016", name: "Módulo DR Tetrapolar 250A para Caixa Moldada", type: "DR", model: "MRW-250A-30mA", poles: 4, current: 250, sensitivity: 30, icu: 35, dins: 0, voltage: 380, price: 1750.00 },

  // DPS — Dispositivos de Proteção contra Surtos WEG
  { code: "10082000", name: "DPS Classe II Monofásico 275V 20kA", type: "DPS", model: "SPW02-275/20", poles: 1, voltage: 275, icu: 20, dins: 1, price: 85.00 },
  { code: "10082001", name: "DPS Classe II 275V 45kA Plug-in", type: "DPS", model: "SPW02-275/45", poles: 1, voltage: 275, icu: 45, dins: 1, price: 110.00 },
  { code: "10082002", name: "DPS Classe II Trifásico 275V 20kA (3P+N)", type: "DPS", model: "SPW02-275/20-3PN", poles: 4, voltage: 275, icu: 20, dins: 4, price: 340.00 },
  { code: "10082010", name: "DPS Classe I+II 255V 50kA", type: "DPS", model: "SPW01-255/50", poles: 1, voltage: 255, icu: 50, dins: 2, price: 320.00 },

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

  // Quadros e Painéis WEG QDF / QGBT
  { code: "10016010", name: "Quadro de Distribuição 12 DIN Embutir", type: "Quadro", model: "QDF-12-E", dins: 12, voltage: 440, price: 75.00 },
  { code: "10016012", name: "Quadro de Distribuição 18 DIN Embutir", type: "Quadro", model: "QDF-18-E", dins: 18, voltage: 440, price: 95.00 },
  { code: "10016014", name: "Quadro de Distribuição 24 DIN Embutir", type: "Quadro", model: "QDF-24-E", dins: 24, voltage: 440, price: 130.00 },
  { code: "10016020", name: "Quadro de Distribuição 36 DIN Embutir", type: "Quadro", model: "QDF-36-E", dins: 36, voltage: 440, price: 180.00 },
  { code: "10016030", name: "Quadro de Distribuição 48 DIN Embutir", type: "Quadro", model: "QDF-48-E", dins: 48, voltage: 440, price: 260.00 },
  { code: "10016035", name: "Quadro de Distribuição 72 DIN Embutir/Sobrepor", type: "Quadro", model: "QDF-72-ES", dins: 72, voltage: 440, price: 380.00 },
  { code: "10016050", name: "QGBT Armário Autoportante 250A", type: "Quadro", model: "QGBT-250-COL", dins: 0, voltage: 690, price: 1650.00 },
  { code: "10016060", name: "QGBT Armário Autoportante 400A", type: "Quadro", model: "QGBT-400-COL", dins: 0, voltage: 690, price: 2900.00 },
  { code: "10016070", name: "QGBT Armário Autoportante 630A", type: "Quadro", model: "QGBT-630-COL", dins: 0, voltage: 690, price: 4800.00 },

  // Barramentos WEG
  { code: "10090001", name: "Barramento Fase Pente 1P 80A", type: "Barramento", model: "BTF-80A-1P", poles: 1, current: 80, price: 38.00, dins: 0 },
  { code: "10090002", name: "Barramento Fase Pente 3P 100A", type: "Barramento", model: "BTF-100A-3P", poles: 3, current: 100, price: 68.00, dins: 0 },
  { code: "10090003", name: "Barramento de Cobre QGBT 630A (metro)", type: "Barramento", model: "BAR-CU-630A", poles: 1, current: 630, price: 280.00, dins: 0 },
  { code: "10090010", name: "Barramento de Neutro Isolado DIN", type: "Barramento", model: "BTN-12", current: 125, price: 28.00, dins: 1 },
  { code: "10090011", name: "Barramento de Terra PE Isolado DIN", type: "Barramento", model: "BTT-12", current: 125, price: 28.00, dins: 1 },
  { code: "10090012", name: "Bloco Distribuidor Tetrapolar 125A", type: "Barramento", model: "BD-4P-125A", poles: 4, current: 125, price: 88.00, dins: 4 },
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
