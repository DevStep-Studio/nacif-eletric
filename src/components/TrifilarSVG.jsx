/**
 * TrifilarSVG v11 — Topologia elétrica real 127V/220V · NBR 5410:2004
 *
 * MONOFÁSICO : 1 fase (127V) + Neutro
 * BIFÁSICO   : 2 fases (127V+127V = 220V entre elas) — SEM neutro no circuito
 * TRIFÁSICO  : 3 fases (127V cada, 220V entre fases)
 *
 * Barramentos: FA=127V, FB=127V, FC=127V, N, PE
 * Zero linhas flutuantes — cada condutor: origem → destino explícitos
 */
import { autoBalancePhases } from "@/lib/electricalEngine";
import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";

// ─── Paleta NBR 5410 ──────────────────────────────────────────────────────────
const C = {
  bg:"#ffffff", frame:"#111827", line:"#0f172a",
  sub:"#51627a", faint:"#e4e9f0", grid:"#f8fafc", title:"#00d8b8",
  FA:"#111827", FB:"#dc2626", FC:"#8b4513",
  N:"#00d8b8",  PE:"#16a34a",
  DR:"#005188", DPS:"#00d8b8",
  panel:"#f6f8fb", warn:"#EEF7FC",
};

const PH_CLR = { A:C.FA, B:C.FB, C:C.FC };
const pc = ph => PH_CLR[ph] || C.FA;

// Próxima fase no ciclo A→B→C→A (para circuitos bifásicos)
const nextPh = ph => ph==="A"?"B":ph==="B"?"C":"A";

// Fases de alimentação do circuito
function circPhases(c) {
  const ph = (c.phase||"A")[0];
  // Detecta trifásico: supply_type explícito ou phase="ABC"
  if (c.supply_type === "Trifásico" || c.phase === "ABC") return ["A","B","C"];
  // Detecta bifásico: supply_type explícito OU phase com 2 chars (ex: "AB", "BC", "AC")
  if (c.supply_type === "Bifásico" || (c.phase && c.phase.length === 2)) return [ph, nextPh(ph)];
  return [ph]; // Monofásico
}

// Tensão nominal do circuito
function circVoltage(c) {
  if (c.supply_type === "Trifásico" || c.supply_type === "Bifásico") return 220;
  return 127;
}

// Descrição de alimentação
function circSupplyDesc(c) {
  const ph = (c.phase||"A")[0];
  if (c.supply_type === "Trifásico") return "FA+FB+FC · 220V";
  if (c.supply_type === "Bifásico")  return `F${ph}+F${nextPh(ph)} · 220V`;
  return `F${ph}+N · 127V`;
}

// Bitola alimentador NBR 5410 T37
function feederGauge(Ib) {
  if (Ib<=15) return {f:"2,5",n:"2,5",pe:"2,5"};
  if (Ib<=21) return {f:"4",  n:"4",  pe:"4"  };
  if (Ib<=28) return {f:"6",  n:"6",  pe:"6"  };
  if (Ib<=36) return {f:"10", n:"10", pe:"6"  };
  if (Ib<=50) return {f:"16", n:"16", pe:"10" };
  if (Ib<=68) return {f:"25", n:"25", pe:"16" };
  if (Ib<=89) return {f:"35", n:"35", pe:"16" };
  return           {f:"50", n:"35", pe:"25" };
}

// ─── Primitivos ───────────────────────────────────────────────────────────────
const L   = (x1,y1,x2,y2,clr,sw=1.0) =>
  <line key={`l${x1}${y1}${x2}${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={clr} strokeWidth={sw}/>;
const DOT = (x,y,clr,r=2.5) =>
  <circle key={`d${x}${y}`} cx={x} cy={y} r={r} fill={clr}/>;

// ─── Bloco retangular genérico ────────────────────────────────────────────────
function Block({cx,y,w=120,h=32,label,sub,color=C.frame}) {
  return (
    <g>
      <rect x={cx-w/2} y={y} width={w} height={h} rx="3"
        fill="white" stroke={color} strokeWidth="0.9"/>
      <text x={cx} y={y+h*0.44} fill={C.title} fontSize="10" textAnchor="middle" fontWeight="800">{label}</text>
      {sub&&<text x={cx} y={y+h*0.76} fill={C.sub} fontSize="7.8" textAnchor="middle">{sub}</text>}
    </g>
  );
}

// ─── Disjuntor IEC multi-polo ────────────────────────────────────────────────
function Breaker({cx,cy,phases,current,curve="C",label,noTag=false}) {
  const n=phases.length, pitch=18, tot=(n-1)*pitch;
  const sx=cx-tot/2, bw=tot+44, bh=44;
  const top=cy-bh/2, bot=cy+bh/2;
  return (
    <g>
      {label&&<text x={cx} y={top-14} fill={C.title} fontSize="9.5" textAnchor="middle" fontWeight="700">{label}</text>}
      <rect x={cx-bw/2} y={top} width={bw} height={bh} rx="2"
        fill="white" stroke={C.line} strokeWidth="0.8"/>
      {/* Trilha de acoplamento */}
      {n>1&&<rect x={sx-3} y={cy-4} width={tot+6} height="8" rx="1" fill={C.line} fillOpacity="0.15"/>}
      {/* Face frontal */}
      <rect x={cx-bw/2+3} y={top+3} width={bw-6} height={bh-6} rx="1"
        fill="white" stroke={C.faint} strokeWidth="0.5"/>
      {/* Botão/alavanca central */}
      <rect x={cx-6} y={cy-7} width="12" height="14" rx="2"
        fill="#e2e8f0" stroke={C.sub} strokeWidth="0.6"/>
      <rect x={cx-4} y={cy-9} width="8" height="8" rx="1"
        fill={C.sub} fillOpacity="0.7"/>
      {phases.map((ph,i)=>{
        const px=sx+i*pitch, col=pc(ph);
        return (
          <g key={ph+i}>
            {/* Terminal superior */}
            {L(px,top-8,px,top,     col,1.5)}
            {/* Contato interno */}
            {L(px,top,  px,cy-8,    col,1.5)}
            {L(px-5,cy-8,px+4,cy+6, col,1.5)}
            {/* Terminal inferior */}
            {L(px,cy+6, px,bot,     col,1.5)}
            {L(px,bot,  px,bot+8,   col,1.5)}
            {/* Marcação polo */}
            <text x={px} y={top+10} fill={col} fontSize="7" textAnchor="middle" fontWeight="700">F{ph}</text>
          </g>
        );
      })}
      {!noTag&&<>
        <text x={cx} y={bot+16} fill={C.line} fontSize="9"   textAnchor="middle" fontWeight="700">
          {n}P · {current}A / Curva {curve}
        </text>
        <text x={cx} y={bot+27} fill={C.sub} fontSize="7.5" textAnchor="middle">IEC 60898</text>
      </>}
    </g>
  );
}

// ─── IDR (diferencial residual) ───────────────────────────────────────────────
function IDR({cx,cy,phases,current}) {
  const n=phases.length, pitch=18, tot=(n-1)*pitch;
  const sx=cx-tot/2, bw=tot+50, bh=50;
  const top=cy-bh/2, bot=cy+bh/2;
  return (
    <g>
      <text x={cx} y={top-26} fill={C.title} fontSize="9.5" textAnchor="middle" fontWeight="700">IDR — Área Molhada</text>
      <text x={cx} y={top-14} fill={C.DR}    fontSize="8"   textAnchor="middle">Diferencial Residual · 30mA · Tipo A</text>
      <rect x={cx-bw/2} y={top} width={bw} height={bh} rx="2"
        fill="white" stroke={C.DR} strokeWidth="1.0"/>
      <rect x={cx-bw/2} y={top} width={bw} height="12" rx="2" fill={C.DR} fillOpacity="0.1"/>
      <text x={cx} y={top+10} fill={C.DR} fontSize="9" textAnchor="middle" fontWeight="700">
        {n+1}P · {current}A · ΔI=30mA
      </text>
      <rect x={cx-9} y={cy-4} width="18" height="8" rx="2" fill={C.DR} fillOpacity="0.8"/>
      <text x={cx} y={cy+3} fill="white" fontSize="7" textAnchor="middle">TEST</text>
      {phases.map((ph,i)=>{
        const px=sx+i*pitch, col=pc(ph);
        return (
          <g key={ph+i}>
            {L(px,top-8,px,top,  col,1.5)}
            {L(px,bot,  px,bot+8,col,1.5)}
          </g>
        );
      })}
    </g>
  );
}

// ─── DPS em derivação shunt ───────────────────────────────────────────────────
// Tap no tronco da fase → condutor horizontal → corpo DPS
// Saída DPS → condutor vertical → barramento PE
function DPS({trunkX,tapY,bodyX,peY,phase}) {
  const col=pc(phase);
  const bTop=tapY+16, bBot=bTop+42;
  return (
    <g>
      {/* Tap no tronco */}
      {DOT(trunkX,tapY,col)}
      {/* Horizontal ao DPS */}
      {L(trunkX,tapY,bodyX,tapY, col,0.8)}
      {/* Descida ao corpo */}
      {L(bodyX,tapY,bodyX,bTop,  col,0.8)}
      {/* Corpo */}
      <rect x={bodyX-16} y={bTop} width="32" height={bBot-bTop} rx="2"
        fill="white" stroke={col} strokeWidth="0.8"/>
      <polygon points={`${bodyX},${bTop+5} ${bodyX+6},${bTop+19} ${bodyX+2},${bTop+19} ${bodyX+4},${bTop+34} ${bodyX-4},${bTop+21} ${bodyX-1},${bTop+21}`}
        fill={col}/>
      {/* Rótulos — zona exclusiva à direita */}
      <text x={bodyX+21} y={bTop+13} fill={col}  fontSize="8"   fontWeight="700">DPS II</text>
      <text x={bodyX+21} y={bTop+23} fill={C.sub} fontSize="7">F{phase}</text>
      <text x={bodyX+21} y={bTop+33} fill={C.sub} fontSize="6.5">Cl.II · 15kA</text>
      {/* Saída PE → barramento PE */}
      {L(bodyX,bBot,bodyX,peY, C.PE,0.8)}
      {DOT(bodyX,peY,C.PE)}
    </g>
  );
}

// ─── Barramento com visual industrial ────────────────────────────────────────
function Busbar({x1,x2,y,color,label}) {
  return (
    <g>
      {/* Corpo do barramento */}
      <rect x={x1} y={y-4} width={x2-x1} height="8" rx="1.5"
        fill={color} fillOpacity={color === C.FA ? "0.05" : "0.10"} stroke={color} strokeWidth="2.0"/>
      <line x1={x1+6} y1={y} x2={x2-6} y2={y} stroke={color} strokeWidth="2.2" opacity="0.9"/>
      {/* Parafusos de fixação */}
      {[x1+10,x1+22,x1+34].map((bx,i)=>(
        <g key={i}>
          <circle cx={bx} cy={y} r="3.5" fill="white" stroke={color} strokeWidth="0.8"/>
          <circle cx={bx} cy={y} r="1.2" fill={color} fillOpacity="0.5"/>
        </g>
      ))}
      <rect x={x1+48} y={y-10} width="225" height="20" rx="3" fill="white" fillOpacity="0.92"/>
      <text x={x1+56} y={y+4} fill={color} fontSize="8.8" fontWeight="800">{label}</text>
    </g>
  );
}

function ColorLegend({x,y}) {
  const rows = [
    ["FA", "Fase A", "preto", C.FA],
    ["FB", "Fase B", "vermelho", C.FB],
    ["FC", "Fase C", "marrom", C.FC],
    ["N", "Neutro", "azul", C.N],
    ["PE", "Terra", "verde", C.PE],
  ];

  return (
    <g>
      <rect x={x} y={y} width="210" height="116" rx="4" fill="white" stroke={C.faint} strokeWidth="1"/>
      <rect x={x} y={y} width="210" height="22" rx="4" fill={C.warn}/>
      <text x={x+12} y={y+15} fill={C.line} fontSize="8.5" fontWeight="800">CÓDIGO DE CORES DOS CONDUTORES</text>
      {rows.map(([code,label,colorName,color], index) => {
        const yy = y + 36 + index * 15;
        return (
          <g key={code}>
            <line x1={x+12} y1={yy-3} x2={x+42} y2={yy-3} stroke={color} strokeWidth="3"/>
            <text x={x+52} y={yy} fill={C.line} fontSize="7.8" fontWeight="800">{code}</text>
            <text x={x+78} y={yy} fill={C.sub} fontSize="7.5">{label} · {colorName}</text>
          </g>
        );
      })}
    </g>
  );
}

function TitleBlock({x,y,w,h,project,metrics,circuits,supply,voltage}) {
  const rev = project?.revision || "01/2026";
  const client = project?.client_name || project?.client || project?.customer || "—";
  const address = project?.address || project?.project_address || "—";
  const totalKw = (metrics?.totalPower / 1000 || 0).toFixed(2);
  const cells = [
    { label:"PROJETO", value:project?.name || "Projeto", width:0.23 },
    { label:"CLIENTE", value:client, width:0.22 },
    { label:"ENDEREÇO", value:address, width:0.28 },
    { label:"REV.", value:rev, width:0.11 },
    { label:"CIRCUITOS", value:String(circuits.length), width:0.08 },
    { label:"POTÊNCIA", value:`${totalKw} kW`, width:0.08 },
  ];

  let cursor = x;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="white" stroke={C.frame} strokeWidth="0.8"/>
      <rect x={x} y={y+h-18} width={w} height="18" fill={C.grid} stroke="none"/>
      {cells.map((cell,index) => {
        const cw = w * cell.width;
        const node = (
          <g key={cell.label}>
            {index > 0 && <line x1={cursor} y1={y} x2={cursor} y2={y+h-18} stroke={C.faint} strokeWidth="0.8"/>}
            <text x={cursor+6} y={y+13} fill={C.sub} fontSize="7.5" fontWeight="800">{cell.label}</text>
            <text x={cursor+6} y={y+27} fill={C.line} fontSize="8.3" fontWeight="800">{String(cell.value).slice(0, 32)}</text>
          </g>
        );
        cursor += cw;
        return node;
      })}
      <text x={x+w/2} y={y+h-6} fill={C.sub} fontSize="7.5" textAnchor="middle">
        NACIF Solutions Eletric · Diagrama Trifilar · NBR 5410:2004 · IEC 60617 · IEC 60445 · Gerado automaticamente
      </text>
      <text x={x+w-8} y={y+h-6} fill={C.sub} fontSize="7.2" textAnchor="end">
        {supply} · {voltage}V
      </text>
    </g>
  );
}

function Ground({cx,cy}) {
  return (
    <g>
      {L(cx,cy,cx,cy+10,  C.PE,1.2)}
      {L(cx-12,cy+10,cx+12,cy+10,C.PE,1.5)}
      {L(cx-8, cy+15,cx+8, cy+15,C.PE,1.2)}
      {L(cx-4, cy+20,cx+4, cy+20,C.PE,1.0)}
    </g>
  );
}

// ─── Caixa de dados do circuito ───────────────────────────────────────────────
function CircuitBox({x,y,c,num}) {
  const ph   = (c.phase||"A")[0];
  const col  = pc(ph);
  const vdOk = c.voltage_drop_ok !== false;
  const cPhs = circPhases(c);
  const CW=188, CH=252;

  const rows = [
    ["Alimentação", circSupplyDesc(c)],
    ["Disjuntor",   `${cPhs.length}P ${c.breaker_a}A C${c.breaker_curve||"B"}`],
    ["I nominal",   `${c.project_current_a} A`],
    ["Bitola",      c.wire_gauge||"—"],
    ["Comprimento", `${c.length_m||15} m`],
    ["Queda ΔU",   `${c.voltage_drop_pct}% ${vdOk?"✓":"⚠"}`],
    ["Instalação",  (c.install_method||"Eletroduto").slice(0,20)],
  ];

  return (
    <g>
      {/* Sombra */}
      <rect x={x+2} y={y+2} width={CW} height={CH} rx="3" fill={C.faint}/>
      <rect x={x}   y={y}   width={CW} height={CH} rx="3"
        fill="white" stroke={col} strokeWidth="0.8"/>
      {/* Barra lateral */}
      <rect x={x} y={y} width="4" height={CH} rx="2" fill={col}/>
      {/* Cabeçalho */}
      <rect x={x}   y={y}   width={CW} height="24" rx="3" fill={col} fillOpacity="0.1"/>
      <rect x={x}   y={y+16} width={CW} height="8"  fill={col} fillOpacity="0.1"/>
      <text x={x+CW/2} y={y+16} fill={col} fontSize="10.5" textAnchor="middle" fontWeight="800">
        C{String(num).padStart(2,"0")} · {(c.name||"Circuito").slice(0,14)}
      </text>
      <text x={x+10} y={y+33} fill={C.sub} fontSize="8.5">{(c.type||"—").slice(0,26)}</text>
      {/* Dados */}
      {rows.map(([k,v],i)=>{
        const dy  = y+46+i*27;
        const vc  = k==="Queda ΔU"?(vdOk?C.PE:"#dc2626"):C.line;
        return (
          <g key={k}>
            {i>0&&<line x1={x+8} y1={dy-8} x2={x+CW-8} y2={dy-8} stroke={C.faint} strokeWidth="0.7"/>}
            <text x={x+10}   y={dy+3} fill={C.sub} fontSize="8.5">{k}</text>
            <text x={x+CW-9} y={dy+3} fill={vc}    fontSize="8.5" textAnchor="end" fontWeight="600">{v}</text>
          </g>
        );
      })}
      {/* Badges */}
      <g transform={`translate(${x+8},${y+CH-38})`}>
        {c.wet_area&&<>
          <rect width="36" height="14" rx="2" fill={C.DPS} fillOpacity="0.12" stroke={C.DPS} strokeWidth="0.7"/>
          <text x="4" y="10" fill={C.DPS} fontSize="7.5" fontWeight="700">IDR</text>
        </>}
        {c.needs_dr&&<>
          <rect x={c.wet_area?40:0} width="40" height="14" rx="2" fill={C.DR} fillOpacity="0.12" stroke={C.DR} strokeWidth="0.7"/>
          <text x={c.wet_area?44:4} y="10" fill={C.DR} fontSize="7.5" fontWeight="700">DR 30mA</text>
        </>}
      </g>
      {/* Conector de chegada (condutor saindo acima da caixa) */}
      {L(x+CW/2,y-18,x+CW/2,y, col,1.5)}
      {DOT(x+CW/2,y,col)}
    </g>
  );
}

// ─── MOTOR PRINCIPAL ──────────────────────────────────────────────────────────
export default function TrifilarSVG({project, metrics}) {
  const raw      = project?.circuits || [];
  const circuits = metrics?.circuits || autoBalancePhases(raw);
  const gbkr     = metrics?.generalBreaker || 40;
  const gamp     = metrics?.generalCurrent || 20;
  const supply   = project?.supply_type || "Trifásico";
  const voltage  = project?.voltage || 220;
  const phases   = supply==="Trifásico"?["A","B","C"]:
                   supply==="Bifásico" ?["A","B"]:["A"];
  const cable    = feederGauge(gamp);
  const hasWetCircuits = circuits.some(c=>c.wet_area);
  const n        = circuits.length;

  // ── X da coluna principal ────────────────────────────────────────────────
  const GEN_CX = 190;
  const PITCH  = 18;
  const phTot  = (phases.length-1)*PITCH;
  const phSX   = GEN_CX - phTot/2;
  const phX    = i => phSX + i*PITCH;
  // N e PE à esquerda do feixe
  const NX     = phSX - 20;
  const PEX    = phSX - 36;

  // ── Y determinísticos ────────────────────────────────────────────────────
  const YA = 64,  YB = 100;  // ENTRADA
  const YC = 128, YD = 164;  // MEDIÇÃO
  const DJ_CY  = 224;        // centro DJ geral
  const DJ_BOT = 250;        // saída DJ
  const DPS_TAP= 292;        // nível tap DPS
  const DPS_BOT= DPS_TAP+60; // abaixo dos DPS

  const TRUNK_END = DPS_BOT+8;
  const BUS_GAP = 48;
  const BUS_START_Y = TRUNK_END+44;
  const phaseBusY = phases.reduce((acc, ph, index) => {
    acc[ph] = BUS_START_Y + index * BUS_GAP;
    return acc;
  }, {});
  const BUS_N  = BUS_START_Y + phases.length * BUS_GAP;
  const BUS_PE = BUS_N + BUS_GAP;
  const BUS_FA = phaseBusY.A || BUS_START_Y;
  const BUS_FB = phaseBusY.B || BUS_FA;
  const BUS_FC = phaseBusY.C || BUS_FB;

  const Z_SEP    = BUS_PE+72;
  const Z_BRK_CY = Z_SEP + (hasWetCircuits ? 206 : 124);
  const Z_BRK_BOT= Z_BRK_CY+28;
  const Z_BOX    = Z_BRK_BOT+24;
  const LEGEND_H = 190;
  const TITLE_BLOCK_H = 56;
  const SVG_H    = Z_BOX+252+20+LEGEND_H+TITLE_BLOCK_H+24;

  // ── DPS (à direita do feixe de fases) ───────────────────────────────────
  const DPS_PITCH = 56;
  const DPS_SX    = GEN_CX + phTot/2 + 72;
  const dpsX      = i => DPS_SX + i*DPS_PITCH;

  // Mapa busbar Y por fase
  const busY = { A:BUS_FA, B:BUS_FB, C:BUS_FC, ...phaseBusY };

  // ── Largura SVG ─────────────────────────────────────────────────────────
  const CW       = 188, CG = 42;
  const circuitAreaW = n > 0 ? n * CW + (n - 1) * CG : 0;
  const SVG_W    = Math.max(circuitAreaW + 560, 1080);
  const BUS_X1 = 244;
  const BX1=BUS_X1, BX2=SVG_W-20;
  const circStart = n > 0 ? Math.max(BUS_X1 + 350, (SVG_W - circuitAreaW) / 2) : BUS_X1 + 350;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{fontFamily:"'Inter','Arial',sans-serif", background:C.bg, display:"block"}}>

      <rect width={SVG_W} height={SVG_H} fill={C.bg}/>
      <rect x="5" y="5" width={SVG_W-10} height={SVG_H-10}
        fill="none" stroke={C.frame} strokeWidth="1.2"/>
      <rect x="12" y="12" width={SVG_W-24} height="36" rx="2" fill={C.grid} stroke={C.faint} strokeWidth="0.8"/>
      <image href={DEFAULT_LOGO_URL} x="22" y="14" width="58" height="30" preserveAspectRatio="xMidYMid meet" />

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <text x={SVG_W/2} y="26" fill={C.title} fontSize="15" textAnchor="middle" fontWeight="900">
        DIAGRAMA TRIFILAR — {(project?.name||"PROJETO").toUpperCase()}
      </text>
      <text x={SVG_W/2} y="42" fill={C.sub} fontSize="8.8" textAnchor="middle" fontWeight="700">
        127V/fase · {phases.length>1?"220V entre fases · ":""}{supply} · NBR 5410:2004 · IEC 60617 · IEC 60445
      </text>
      <line x1="12" y1="54" x2={SVG_W-12} y2="54" stroke={C.frame} strokeWidth="1"/>
      <ColorLegend x={SVG_W - 244} y="66"/>

      {/* ── ENTRADA ──────────────────────────────────────────────── */}
      <Block cx={GEN_CX} y={YA} w={150} h={36}
        label="REDE / ENTRADA"
        sub={`${supply} · 127V/fase${phases.length>1?" · 220V fases":""}`}
        color={C.frame}/>
      {/* Condutores entrada → medição */}
      {phases.map((ph,i) => L(phX(i),YB,phX(i),YC, pc(ph),1.5))}
      {L(NX, YB, NX, YC, C.N,  1.2)}
      {L(PEX,YB, PEX,YC, C.PE, 1.2)}

      {/* ── MEDIÇÃO ──────────────────────────────────────────────── */}
      <Block cx={GEN_CX} y={YC} w={128} h={36}
        label="MEDIÇÃO kWh"
        sub="Classe B · Bidirecional"
        color={C.sub}/>
      {/* Condutores medição → DJ */}
      {phases.map((ph,i) => L(phX(i),YD,phX(i),DJ_CY-26, pc(ph),1.5))}
      {L(NX, YD, NX, DJ_CY-26, C.N,  1.2)}
      {L(PEX,YD, PEX,DJ_CY-26, C.PE, 1.2)}

      {/* ── DJ GERAL ──────────────────────────────────────────────── */}
      <Breaker cx={GEN_CX} cy={DJ_CY} phases={phases} current={gbkr} curve="C" label="DJ GERAL"/>
      <text x={GEN_CX+phTot/2+34} y={DJ_CY-8} fill={C.line} fontSize="8.5" fontWeight="600">
        {phases.length}×{cable.f}mm² + N{cable.n}mm² + PE{cable.pe}mm²
      </text>
      <text x={GEN_CX+phTot/2+34} y={DJ_CY+6} fill={C.sub}  fontSize="8">
        Ib={gamp}A · Icc≤{gbkr>40?"25":"15"}kA
      </text>

      {/* Troncos de fase do DJ até nível DPS_TAP */}
      {phases.map((ph,i) => L(phX(i),DJ_BOT,phX(i),DPS_TAP+4, pc(ph),1.5))}
      {/* N e PE: descidas do alimentador até barramentos dedicados */}
      {L(NX, DJ_BOT, NX, BUS_N,  C.N,  1.2)}
      {L(PEX,DJ_BOT, PEX,BUS_PE, C.PE, 1.2)}

      {/* ── DPS — DERIVAÇÃO SHUNT INDIVIDUAL POR FASE ─────────────── */}
      {phases.map((ph,i) => (
        <DPS key={ph}
          trunkX={phX(i)}
          tapY={DPS_TAP}
          bodyX={dpsX(i)}
          peY={BUS_PE}
          phase={ph}
        />
      ))}

      {/* Troncos de fase abaixo do tap DPS → IDR ou barramento */}
      {phases.map((ph,i) => (
        <g key={`phase-feed-${ph}`}>
          {L(phX(i), DPS_TAP+4, phX(i), busY[ph], pc(ph), 1.5)}
          {L(phX(i), busY[ph], BUS_X1, busY[ph], pc(ph), 1.2)}
          {DOT(phX(i), busY[ph], pc(ph))}
          {DOT(BUS_X1, busY[ph], pc(ph))}
        </g>
      ))}
      {L(NX, BUS_N, BUS_X1, BUS_N, C.N, 1.0)}
      {L(PEX, BUS_PE, BUS_X1, BUS_PE, C.PE, 1.0)}
      {DOT(NX, BUS_N, C.N)}
      {DOT(PEX, BUS_PE, C.PE)}
      {DOT(BUS_X1, BUS_N, C.N)}
      {DOT(BUS_X1, BUS_PE, C.PE)}

      {/* ── BARRAMENTOS ───────────────────────────────────────────── */}
      {phases.includes("A") && <Busbar x1={BX1} x2={BX2} y={BUS_FA} color={C.FA} label="Fase A — 127V — Preto"/>}
      {phases.includes("B") && <Busbar x1={BX1} x2={BX2} y={BUS_FB} color={C.FB} label="Fase B — 127V — Vermelho"/>}
      {phases.includes("C") && <Busbar x1={BX1} x2={BX2} y={BUS_FC} color={C.FC} label="Fase C — 127V — Marrom"/>}
      <Busbar x1={BX1} x2={BX2} y={BUS_N}  color={C.N}  label="Neutro (N) — Azul-claro"/>
      <Busbar x1={BX1} x2={BX2} y={BUS_PE} color={C.PE} label="Proteção (PE) — Verde / verde-amarelo"/>
      <Ground cx={BX2-16} cy={BUS_PE+6}/>

      {/* Legenda tensão entre fases */}
      {phases.length>1 && <>
        <text x={BX2-12} y={BUS_FA-10} fill={C.sub} fontSize="8" textAnchor="end">220V entre fases</text>
        {L(BX2-10,BUS_FA,BX2-10,busY[phases[phases.length-1]], C.sub,0.6)}
        {L(BX2-14,BUS_FA,BX2-6,BUS_FA,  C.sub,0.6)}
        {L(BX2-14,busY[phases[phases.length-1]],BX2-6,busY[phases[phases.length-1]], C.sub,0.6)}
      </>}

      {/* ── Separador de circuitos ─────────────────────────────────── */}
      <line x1="12" y1={Z_SEP} x2={SVG_W-12} y2={Z_SEP}
        stroke={C.faint} strokeWidth="1" strokeDasharray="10,5"/>
      <text x={SVG_W/2} y={Z_SEP+14} fill={C.sub} fontSize="9.5" textAnchor="middle">
        CIRCUITOS FINAIS — {n} circuito{n!==1?"s":""}
        {hasWetCircuits?" · IDR obrigatório (áreas molhadas)":""}
      </text>

      {n===0 && (
        <text x={SVG_W/2} y={Z_BOX+80} fill={C.sub} fontSize="13" textAnchor="middle">
          Nenhum circuito cadastrado
        </text>
      )}

      {/* ── CIRCUITOS ─────────────────────────────────────────────── */}
      {circuits.map((c,i) => {
        const ph    = (c.phase||"A")[0];
        const col   = pc(ph);
        const cPhs  = circPhases(c);
        const laneX = circStart + i*(CW+CG);
        const laneCX= laneX + CW/2;

        // Tap no barramento dominante (fase do circuito)
        const tapBY = busY[ph] || BUS_FA;

        // DJ do circuito
        const brkTop= Z_BRK_CY-26;
        const brkBot= Z_BRK_BOT;

        // IDR individual (somente área molhada)
        const drCY  = Z_SEP+98;
        const drBot = drCY+34;

        return (
          <g key={i}>
            {/* Rótulo sobre o tap */}
            <text x={laneCX} y={tapBY-11} fill={col} fontSize="8.5"
              textAnchor="middle" fontWeight="700">C{String(i+1).padStart(2,"0")}</text>

            {/* Tap no barramento de fase */}
            {DOT(laneCX,tapBY,col)}
            {/* Condutor de fase: barramento → DJ (ou IDR primeiro se área molhada) */}
            {L(laneCX,tapBY+4,laneCX,
              c.wet_area ? drCY-30 : brkTop,
              col,1.2)}

            {/* Para bifásico/trifásico: taps extras nas outras fases */}
            {cPhs.slice(1).map((phX, pIdx) => {
              const col2 = pc(phX);
              const bY2  = busY[phX] || BUS_FB;
              const xOff = laneCX + 8 * (pIdx + 1);
              return (
                <g key={`extra-tap-${phX}-${pIdx}`}>
                  {DOT(xOff, bY2, col2)}
                  {L(xOff, bY2 + 4, xOff, brkTop + 14, col2, 1.0)}
                </g>
              );
            })}

            {/* N (somente monofásico) */}
            {cPhs.length===1 && <>
              {L(laneX+8,BUS_N+4, laneX+8,Z_BOX+28, C.N, 0.8)}
            </>}

            {/* PE — todos os circuitos */}
            {L(laneX+18,BUS_PE+4,laneX+18,Z_BOX+28, C.PE,0.8)}

            {/* Separador de lane */}
            {i>0&&<line x1={laneX-CG/2} y1={Z_SEP+2}
              x2={laneX-CG/2} y2={Z_BOX+252}
              stroke={C.faint} strokeWidth="0.7"/>}

            {/* IDR — somente área molhada */}
            {c.wet_area&&<>
              <IDR cx={laneCX} cy={drCY} phases={cPhs} current={c.breaker_a}/>
              {L(laneCX,drBot,laneCX,brkTop, col,1.2)}
            </>}

            {/* DJ do circuito */}
            <Breaker cx={laneCX} cy={Z_BRK_CY} phases={cPhs}
              current={c.breaker_a} curve={c.breaker_curve||"B"} noTag/>
            <text x={laneCX} y={brkBot+14} fill={col}  fontSize="8.5" textAnchor="middle" fontWeight="600">
              {cPhs.length}P·{c.breaker_a}A·C{c.breaker_curve||"B"}
            </text>

            {/* Condutor DJ → caixa */}
            {L(laneCX,brkBot,laneCX,Z_BOX-18, col,1.2)}

            <CircuitBox x={laneX} y={Z_BOX} c={c} num={i+1}/>
          </g>
        );
      })}

      {/* ── LEGENDA / SIMBOLOGIA ────────────────────────────────── */}
      {(() => {
        const LY = Z_BOX+252+20;
        const LW = SVG_W-24;
        const col1 = 36, col2 = LW/4+12, col3 = LW/2+12, col4 = LW*3/4+12;
        const rowH = 36;

        // Mini breaker symbol
        const MiniBreaker = ({x,y,color=C.line}) => (
          <g>
            <rect x={x-8} y={y-12} width={16} height={24} rx="1.5" fill="white" stroke={color} strokeWidth="1"/>
            <line x1={x} y1={y-12} x2={x} y2={y-6} stroke={color} strokeWidth="1"/>
            <line x1={x-4} y1={y-6} x2={x+4} y2={y+2} stroke={color} strokeWidth="1"/>
            <line x1={x} y1={y+2} x2={x} y2={y+12} stroke={color} strokeWidth="1"/>
          </g>
        );

        // Mini IDR symbol
        const MiniIDR = ({x,y}) => (
          <g>
            <rect x={x-10} y={y-13} width={20} height={26} rx="1.5" fill="white" stroke={C.DR} strokeWidth="1"/>
            <rect x={x-6} y={y-4} width={12} height={6} rx="1" fill={C.DR} fillOpacity="0.7"/>
            <text x={x} y={y+1} fill="white" fontSize="4.5" textAnchor="middle" fontWeight="700">TEST</text>
          </g>
        );

        // Mini DPS symbol
        const MiniDPS = ({x,y}) => (
          <g>
            <rect x={x-9} y={y-12} width={18} height={24} rx="1.5" fill="white" stroke={C.DPS} strokeWidth="1"/>
            <polygon points={`${x},${y-8} ${x+4},${y} ${x+1.5},${y} ${x+3},${y+8} ${x-3},${y+1} ${x-1},${y+1}`} fill={C.DPS}/>
          </g>
        );

        const items = [
          // col1
          { x: col1, label: "Disjuntor (DJ)",       sub: "Curva C · NBR IEC 60898",    sym: (x,y) => <MiniBreaker x={x} y={y}/> },
          { x: col1, label: "Disjuntor Geral",      sub: "Proteção geral da instalação",sym: (x,y) => <MiniBreaker x={x} y={y} color={C.PE}/> },
          { x: col1, label: "Medição kWh",          sub: "Medidor bidirecional Cl.B",   sym: (x,y) => <g><rect x={x-10} y={y-10} width={20} height={20} rx="2" fill="white" stroke={C.sub} strokeWidth="1"/><text x={x} y={y+3} fill={C.sub} fontSize="5" textAnchor="middle" fontWeight="700">kWh</text></g> },
          { x: col1, label: "Entrada / Rede",       sub: "Alimentação concessionária",  sym: (x,y) => <g><rect x={x-10} y={y-10} width={20} height={20} rx="2" fill="white" stroke={C.frame} strokeWidth="1"/><text x={x} y={y+3} fill={C.frame} fontSize="4.5" textAnchor="middle" fontWeight="700">REDE</text></g> },
          // col2
          { x: col2, label: "IDR Diferencial",      sub: "Residual 30mA · Tipo A",      sym: (x,y) => <MiniIDR x={x} y={y}/> },
          { x: col2, label: "DPS Classe II",        sub: "Proteção surto · 15kA",       sym: (x,y) => <MiniDPS x={x} y={y}/> },
          { x: col2, label: "Ponto de derivação",   sub: "Conexão entre condutores",    sym: (x,y) => <circle cx={x} cy={y} r={4} fill={C.FA}/> },
          { x: col2, label: "Barramento",           sub: "Barra de distribuição",        sym: (x,y) => <g><rect x={x-14} y={y-4} width={28} height={8} rx="1" fill="#E6F2FA" stroke={C.N} strokeWidth="1.2"/></g> },
          // col3
          { x: col3, label: "Fase A — 127V",        sub: "Condutor preto",              sym: (x,y) => <g><line x1={x-14} y1={y} x2={x+14} y2={y} stroke={C.FA} strokeWidth="2.5"/></g> },
          { x: col3, label: "Fase B — 127V",        sub: "Condutor vermelho",           sym: (x,y) => <g><line x1={x-14} y1={y} x2={x+14} y2={y} stroke={C.FB} strokeWidth="2.5"/></g> },
          { x: col3, label: "Fase C — 127V",        sub: "Condutor marrom",              sym: (x,y) => <g><line x1={x-14} y1={y} x2={x+14} y2={y} stroke={C.FC} strokeWidth="2.5"/></g> },
          { x: col3, label: "220V entre fases",     sub: "Tensão de linha A-B, B-C, A-C",sym: (x,y) => <g><line x1={x-14} y1={y-3} x2={x+14} y2={y-3} stroke={C.FA} strokeWidth="1.5"/><line x1={x-14} y1={y+3} x2={x+14} y2={y+3} stroke={C.FB} strokeWidth="1.5"/></g> },
          // col4
          { x: col4, label: "Neutro (N)",           sub: "Condutor azul-claro",         sym: (x,y) => <g><line x1={x-14} y1={y} x2={x+14} y2={y} stroke={C.N} strokeWidth="2.5"/></g> },
          { x: col4, label: "Proteção (PE)",        sub: "Verde / verde-amarelo",       sym: (x,y) => <g><line x1={x-14} y1={y} x2={x+14} y2={y} stroke={C.PE} strokeWidth="2.5"/></g> },
          { x: col4, label: "Aterramento",          sub: "Terra de proteção NR10",      sym: (x,y) => <g><line x1={x} y1={y-8} x2={x} y2={y-2} stroke={C.PE} strokeWidth="1.5"/><line x1={x-8} y1={y-2} x2={x+8} y2={y-2} stroke={C.PE} strokeWidth="2"/><line x1={x-5} y1={y+2} x2={x+5} y2={y+2} stroke={C.PE} strokeWidth="1.5"/><line x1={x-2} y1={y+6} x2={x+2} y2={y+6} stroke={C.PE} strokeWidth="1"/></g> },
          { x: col4, label: "Bitola do cabo",       sub: "2,5 / 4 / 6 / 10 / 16 mm²",  sym: (x,y) => <g><line x1={x-14} y1={y} x2={x+14} y2={y} stroke={C.sub} strokeWidth="4"/><text x={x} y={y-7} fill={C.sub} fontSize="5" textAnchor="middle">mm²</text></g> },
        ];

        const cols = [col1,col2,col3,col4];
        const colItems = cols.map(c => items.filter(it => it.x === c));

        return (
          <g>
            {/* Caixa da legenda */}
            <rect x={12} y={LY} width={SVG_W-24} height={LEGEND_H} rx="4"
              fill={C.grid} stroke={C.frame} strokeWidth="1"/>
            {/* Cabeçalho */}
            <rect x={12} y={LY} width={SVG_W-24} height={22} rx="4"
              fill={C.title} fillOpacity="0.08" stroke="none"/>
            <text x={SVG_W/2} y={LY+14} fill={C.title} fontSize="10.5"
              textAnchor="middle" fontWeight="800">LEGENDA — SIMBOLOGIA IEC 60617 / NBR 5410:2004</text>
            <line x1={12} y1={LY+22} x2={SVG_W-12} y2={LY+22} stroke={C.frame} strokeWidth="0.7"/>

            {/* Divisores de coluna */}
            {[col2-30, col3-30, col4-30].map((cx,i) => (
              <line key={i} x1={cx} y1={LY+22} x2={cx} y2={LY+LEGEND_H}
                stroke={C.faint} strokeWidth="0.8"/>
            ))}

            {/* Itens */}
            {colItems.map((grp, gi) =>
              grp.map((item, ri) => {
                const iy = LY+38 + ri*rowH;
                const symX = item.x + 16;
                const txtX = item.x + 34;
                return (
                  <g key={`${gi}-${ri}`}>
                    {item.sym(symX, iy)}
                    <text x={txtX} y={iy-3} fill={C.line}  fontSize="8.5" fontWeight="700">{item.label}</text>
                    <text x={txtX} y={iy+8} fill={C.sub}   fontSize="7.5">{item.sub}</text>
                  </g>
                );
              })
            )}
          </g>
        );
      })()}

      {/* ── Rodapé ───────────────────────────────────────────────── */}
      <TitleBlock
        x={12}
        y={SVG_H-TITLE_BLOCK_H-12}
        w={SVG_W-24}
        h={TITLE_BLOCK_H}
        project={project}
        metrics={metrics}
        circuits={circuits}
        supply={supply}
        voltage={voltage}
      />
    </svg>
  );
}
