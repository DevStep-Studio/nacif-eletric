import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { calcProjectMetrics } from "@/lib/electricalEngine";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { Activity, AlertTriangle, CheckCircle2, Zap, ArrowLeftRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader";

const PHASES = ["A", "B", "C"];
const PH_COLOR = { A: "#00d8b8", B: "#00d8b8", C: "#16a34a" };
const PH_TEXT = { A: "text-[#B86B00]", B: "text-[#00d8b8]", C: "text-emerald-700" };
const PH_BG = { A: "bg-[#FFF8E6] border-[#F6D58B]", B: "bg-[#EFF6FF] border-[#BFDBFE]", C: "bg-[#ECFDF3] border-[#ABEFC6]" };

const formatAmp = (value) =>
  `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} A`;

const formatKw = (value) =>
  `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;

function BalanceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="rounded-[12px] border border-[#CDEFE8] bg-white px-3 py-2 text-sm shadow-[0_14px_40px_rgba(0,100,166,0.14)]">
      <p className="font-extrabold text-[#0f1728]">{item.name}</p>
      <p className="mt-1 font-semibold text-[#687386]">Corrente: <span className="text-[#0f1728]">{formatAmp(item.corrente)}</span></p>
      <p className="font-semibold text-[#687386]">Potência: <span className="text-[#0f1728]">{formatKw(item.potencia)}</span></p>
    </div>
  );
}

export default function PhaseBalance() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(searchParams.get("project") || "");
  const [project, setProject]   = useState(null);
  const [metrics, setMetrics]   = useState(null);

  useEffect(() => { backend.entities.Project.list().then(setProjects); }, []);
  useEffect(() => {
    if (!selected) return;
    backend.entities.Project.get(selected).then(p => {
      setProject(p);
      setMetrics(calcProjectMetrics(p));
    });
  }, [selected]);

  const m = metrics;
  const circuits = m?.circuits || [];
  const phaseLoad = m?.phaseLoad || { A: 0, B: 0, C: 0 };
  const maxI = Math.max(phaseLoad.A, phaseLoad.B, phaseLoad.C, 1);
  const avgI = PHASES.reduce((sum, ph) => sum + Number(phaseLoad[ph] || 0), 0) / 3;
  const isOverload = (m?.imbalance_pct || 0) > 10;
  const isWarning  = (m?.imbalance_pct || 0) > 5 && !isOverload;
  const statusLabel = isOverload ? "Crítico" : isWarning ? "Atenção" : "Adequado";
  const statusTone = isOverload
    ? "border-red-200 bg-red-50 text-red-700"
    : isWarning
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const barData = PHASES.map(ph => ({
    name: `Fase ${ph}`,
    corrente: Math.round(phaseLoad[ph] * 10) / 10,
    potencia: Math.round((phaseLoad[ph] * (project?.voltage || 220)) / 100) / 10,
    fill: PH_COLOR[ph],
  }));

  const phaseCircuits = { A: [], B: [], C: [] };
  circuits.forEach(c => {
    const ph = c.phase || "A";
    if (ph === "ABC") { phaseCircuits.A.push(c); phaseCircuits.B.push(c); phaseCircuits.C.push(c); }
    else if (ph.length === 2) { phaseCircuits[ph[0]]?.push(c); phaseCircuits[ph[1]]?.push(c); }
    else if (phaseCircuits[ph]) phaseCircuits[ph].push(c);
  });

  return (
    <div className="mx-auto w-full max-w-[1520px] space-y-5 pb-20">
      <PageHeader
        icon={Activity}
        title="Balanceamento de Fases"
        subtitle="Distribuição automática A, B, C · NBR 5410"
      >
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <SelectValue placeholder="Selecionar projeto..." />
          </SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>

      {!project ? (
        <div className="rounded-[18px] border border-dashed border-[#BCEEE5] bg-[#F2FFFC] px-6 py-14 text-center shadow-[0_14px_34px_rgba(0,100,166,0.04)]">
          <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-[#00d8b8]" />
          <p className="text-base font-extrabold text-[#101828]">Selecione um projeto</p>
          <p className="mt-1 text-sm font-medium text-[#667085]">Escolha um projeto para visualizar a distribuição entre fases.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-[18px] border border-[#BCEEE5] bg-white shadow-[0_18px_45px_rgba(0,100,166,0.06)]">
              <div className="border-b border-[#CDEFE8] bg-[#E8FCF8] px-5 py-4">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#00d8b8]">
                  Resumo técnico
                </p>
                <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-[#101828]">
                  Balanceamento do quadro
                </h2>
              </div>

              <div className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    {isOverload || isWarning ? (
                      <span className={`flex h-11 w-11 items-center justify-center rounded-[13px] ring-1 ${isOverload ? "bg-red-50 text-red-600 ring-red-200" : "bg-amber-50 text-amber-600 ring-amber-200"}`}>
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                    )}
                    <div>
                      <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">Status</p>
                      <Badge className={`mt-1 rounded-[10px] border px-3 py-1 font-extrabold ${statusTone}`}>{statusLabel}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#687386]">
                    {isOverload
                      ? "Redistribua circuitos entre fases antes de finalizar o quadro."
                      : isWarning
                        ? "O projeto está utilizável, mas ainda há margem para melhorar a distribuição."
                        : "As fases estão dentro de uma distribuição operacional adequada."}
                  </p>
                </div>

                <div className="grid gap-2 sm:min-w-[420px] sm:grid-cols-3">
                  {[
                    { label: "Desequilíbrio", value: `${m.imbalance_pct}%` },
                    { label: "Neutro estimado", value: formatAmp(m.neutral_a) },
                    { label: "Disjuntor geral", value: `${m.generalBreaker} A` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[14px] border border-[#CDEFE8] bg-[#F7FBFE] p-4 shadow-[0_10px_24px_rgba(0,100,166,0.035)]">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#667085]">{item.label}</p>
                      <p className="mt-2 text-[22px] font-extrabold leading-tight text-[#101828]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-[#BCEEE5] bg-[#E8FCF8] p-5 shadow-[0_18px_45px_rgba(0,100,166,0.08)]">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#00d8b8]">Carga total</p>
              <p className="mt-3 text-[34px] font-extrabold leading-none text-[#101828]">{formatKw((m.totalPower || 0) / 1000)}</p>
              <p className="mt-3 text-sm font-bold text-[#667085]">Média por fase: {formatAmp(avgI)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {PHASES.map((ph) => (
                  <div key={ph} className={`rounded-[13px] border px-3 py-3 ${PH_BG[ph]}`}>
                    <p className={`text-xs font-extrabold ${PH_TEXT[ph]}`}>Fase {ph}</p>
                    <p className="mt-1 text-[15px] font-extrabold text-[#101828]">{formatAmp(phaseLoad[ph])}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Cards por fase */}
          <div className="grid gap-4 lg:grid-cols-3">
            {PHASES.map(ph => {
              const I = phaseLoad[ph];
              const pct = maxI > 0 ? (I / maxI) * 100 : 0;
              const kw = I * (project?.voltage || 220) / 1000;
              return (
                <div key={ph} className="relative overflow-hidden rounded-[18px] border border-[#CDEFE8] bg-white p-5 shadow-[0_18px_45px_rgba(0,100,166,0.05)] transition hover:-translate-y-0.5 hover:border-[#BCEEE5] hover:shadow-[0_20px_48px_rgba(0,100,166,0.08)]">
                  <span className="absolute inset-y-5 left-0 w-1 rounded-r-full" style={{ backgroundColor: PH_COLOR[ph] }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className={`rounded-[12px] border px-3 py-2 ${PH_BG[ph]}`}>
                      <p className={`text-sm font-extrabold ${PH_TEXT[ph]}`}>Fase {ph}</p>
                    </div>
                    <Badge variant="outline" className="rounded-[10px] border-[#BCEEE5] bg-white px-3 py-1 text-xs font-extrabold text-[#101828]">
                      {phaseCircuits[ph].length} circuito{phaseCircuits[ph].length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#687386]">Corrente</p>
                      <p className="mt-1 text-4xl font-extrabold leading-none text-[#101828]">{formatAmp(I).replace(" A", "")}<span className="ml-1 text-base font-bold text-[#687386]">A</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#687386]">Potência</p>
                      <p className="mt-1 text-lg font-extrabold text-[#101828]">{formatKw(kw)}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-bold text-[#687386]">
                      <span>Carga relativa</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-[7px] bg-[#EEF2F6]">
                      <div className="h-full rounded-[6px] transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: PH_COLOR[ph] }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gráfico */}
          <div className="overflow-hidden rounded-[18px] border border-[#BCEEE5] bg-white shadow-[0_18px_45px_rgba(0,100,166,0.06)]">
            <div className="border-b border-[#CDEFE8] bg-[#F7FBFE] px-5 py-4">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-lg font-extrabold text-[#101828]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white text-[#00d8b8] ring-1 ring-[#D6E8F3]">
                    <Zap className="h-4 w-4" />
                  </span>
                  Corrente por fase
                </p>
                <p className="mt-1 text-sm font-medium text-[#687386]">Comparação direta da corrente calculada para cada fase.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PHASES.map((ph) => (
                  <span key={ph} className={`rounded-[10px] border px-3 py-1 text-xs font-extrabold ${PH_BG[ph]} ${PH_TEXT[ph]}`}>Fase {ph}</span>
                ))}
              </div>
            </div>
            </div>
            <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 13, fill: "#687386", fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fontSize: 12, fill: "#687386", fontWeight: 600 }} axisLine={false} tickLine={false} unit=" A" width={58} />
                <Tooltip content={<BalanceTooltip />} cursor={{ fill: "rgba(15,23,42,0.035)" }} />
                <ReferenceLine y={maxI} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Maior fase", fill: "#687386", fontSize: 11, fontWeight: 700, position: "insideTopRight" }} />
                <Bar dataKey="corrente" radius={[8, 8, 4, 4]} maxBarSize={96}>
                  {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Alertas NBR */}
          {m.validations?.length > 0 && (
            <div className="rounded-[18px] border border-[#BCEEE5] bg-white p-5 shadow-[0_18px_45px_rgba(0,100,166,0.05)]">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#667085]">Validações NBR 5410</p>
              <div className="mt-3 space-y-2">
              {m.validations.map((v, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-[12px] border px-3 py-3 text-sm font-bold ${v.severity === "error" ? "border-red-200 bg-red-50 text-red-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{v.msg}
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Circuitos por fase */}
          <div className="rounded-[18px] border border-[#BCEEE5] bg-[#F7FBFE] p-5 shadow-[0_18px_45px_rgba(0,100,166,0.055)]">
            <div className="mb-4">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#00d8b8]">Distribuição detalhada</p>
              <h2 className="mt-1 text-[22px] font-extrabold text-[#101828]">Circuitos por fase</h2>
              <p className="mt-1 text-sm font-medium text-[#687386]">Distribuição técnica com tensão, corrente, bitola e queda de tensão.</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {PHASES.map(ph => (
                <div key={ph} className="min-w-0 rounded-[16px] border border-[#CDEFE8] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-4 w-1.5 rounded-[3px]" style={{ backgroundColor: PH_COLOR[ph] }} />
                      <p className={`truncate text-sm font-extrabold ${PH_TEXT[ph]}`}>
                        Fase {ph}
                      </p>
                    </div>
                    <span className="rounded-[9px] border border-[#BCEEE5] bg-[#F2FFFC] px-2.5 py-1 text-xs font-extrabold text-[#101828]">
                      {phaseCircuits[ph].length}
                    </span>
                  </div>

                  {phaseCircuits[ph].length === 0 ? (
                    <div className="rounded-[12px] border border-dashed border-[#BCEEE5] bg-[#F7FBFE] px-3 py-4 text-sm font-semibold text-[#687386]">
                      Nenhum circuito atribuído
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[12px] border border-[#CDEFE8] bg-white">
                      {phaseCircuits[ph].map((c, i) => (
                        <div key={i} className="grid grid-cols-[minmax(0,1.4fr)_72px_72px] gap-3 border-b border-[#edf0f4] px-3 py-3 text-sm last:border-0">
                          <div className="min-w-0">
                            <p className="truncate font-extrabold text-[#0f1728]">{c.name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-[#687386]">{c.voltage}V · {c.wire_gauge}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a94a6]">Corrente</p>
                            <p className="mt-1 font-extrabold text-[#0f1728]">{formatAmp(c.project_current_a)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a94a6]">Queda</p>
                            <p className={`mt-1 font-extrabold ${c.voltage_drop_ok ? "text-emerald-700" : "text-red-600"}`}>ΔU {c.voltage_drop_pct}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
