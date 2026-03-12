// src/AppShell.jsx
import { useState, useRef } from "react";
import UploadScreen from "./components/UploadScreen";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  Zap, Flame, Home, Upload, BarChart2, Settings,
  CheckCircle, ChevronRight, Bell, RefreshCw, ArrowUpRight,
  TrendingUp, CloudUpload, Trash2, Pencil, X, Check
} from "lucide-react";
import { supabase } from "./lib/supabase";

const C = {
  bg:"#080808", surface:"#111111", surface2:"#181818",
  border:"#1e1e1e", border2:"#252525",
  amber:"#f59e0b", amberDim:"#f59e0b20", amberMid:"#f59e0b40",
  sky:"#38bdf8",   skyDim:"#38bdf820",   skyMid:"#38bdf840",
  green:"#22c55e", greenDim:"#22c55e18",
  red:"#ef4444",   redDim:"#ef444415",
  text:"#ffffff",  textMid:"#9ca3af",    textDim:"#4b5563",
};

// Benchmark medie famiglie italiane (ISTAT)
const BENCHMARK_LUCE_MESE = 225;  // kWh/mese (2700/anno)
const BENCHMARK_GAS_MESE  = 117;  // Smc/mese (1400/anno)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function meseFmt(isoDate) {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleDateString("it-IT", { month:"short" })
      .replace(".","").replace(/^\w/, c => c.toUpperCase());
  } catch { return ""; }
}

function n2(v) { return v != null ? Number(v).toFixed(2) : "—"; }

// Calcola percentuale anello rispetto alla media mensile italiana
function calcPct(bollette, benchmark) {
  if (!bollette.length) return 2; // arco minimo visibile
  // media mensile del consumo fatturato
  const mediaConsumi = bollette.reduce((s,b) => s + Number(b.consumo_fatturato||0), 0) / bollette.length;
  return Math.min(Math.round((mediaConsumi / benchmark) * 100), 100);
}

// Costruisce i dati grafico dai consumi mensili storici estratti dal PDF.
// Funziona dalla prima bolletta in poi (usa storico_mensile del PDF).
// Fallback automatico su consumo_fatturato spalmato sui mesi del periodo.
function buildChartDataFromStorico(bollette, tipo) {
  const maxItems = tipo === "LUCE" ? 15 : 16;
  const valueKey = tipo === "LUCE" ? "kwh" : "smc";
  const mesMap   = new Map(); // "YYYY-MM" → consumo mensile

  // Ordina bollette dalla più vecchia alla più recente
  // (la più recente sovrascrive per i mesi in sovrapposizione)
  const sorted = [...bollette].sort((a,b) =>
    new Date(a.periodo_fine||0) - new Date(b.periodo_fine||0)
  );

  sorted.forEach(b => {
    // ── 1. Storico mensile dal PDF (fonte primaria) ──────────────────────────
    const storico = b.dati_estratti?.storico_mensile ?? [];
    storico.forEach(s => {
      if (s.mese && s.consumo != null && Number(s.consumo) > 0) {
        mesMap.set(s.mese, Math.round(Number(s.consumo)));
      }
    });

    // ── 2. Fallback: consumo_fatturato spalmato sui mesi del periodo ─────────
    if (b.periodo_fine && b.consumo_fatturato) {
      const dFine   = new Date(b.periodo_fine);
      const dInizio = b.periodo_inizio ? new Date(b.periodo_inizio) : dFine;
      const mesiPeriodo = [];
      let cur = new Date(dInizio.getFullYear(), dInizio.getMonth(), 1);
      const endM = new Date(dFine.getFullYear(), dFine.getMonth(), 1);
      while (cur <= endM) {
        mesiPeriodo.push(
          `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`
        );
        cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
      }
      const consumoMensile = Math.round(
        Number(b.consumo_fatturato) / Math.max(mesiPeriodo.length, 1)
      );
      mesiPeriodo.forEach(key => {
        if (!mesMap.has(key) && consumoMensile > 0)
          mesMap.set(key, consumoMensile);
      });
    }
  });

  return [...mesMap.entries()]
    .filter(([,v]) => v > 0)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .slice(-maxItems)
    .map(([mese, val]) => ({ mese: meseFmt(mese + "-01"), [valueKey]: val }));
}

// ─── Components ───────────────────────────────────────────────────────────────

function EmptyState({ onGoUpload }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"40px 20px", textAlign:"center" }}>
      <div style={{ background:C.amberDim, borderRadius:24, padding:20 }}>
        <CloudUpload size={36} color={C.amber} />
      </div>
      <div>
        <p style={{ color:C.text, fontSize:18, fontWeight:700, margin:"0 0 8px", fontFamily:"'Sora',sans-serif" }}>
          Nessuna bolletta ancora
        </p>
        <p style={{ color:C.textDim, fontSize:13, margin:0, lineHeight:1.6 }}>
          Carica la tua prima bolletta per vedere<br/>i consumi e le statistiche
        </p>
      </div>
      <button onClick={onGoUpload} style={{
        background:C.amber, border:"none", borderRadius:18,
        padding:"14px 28px", cursor:"pointer",
        color:"#000", fontSize:14, fontWeight:700,
      }}>
        Carica prima bolletta
      </button>
    </div>
  );
}

function RingCard({ tipo, label, value, unit, pct, vsAnno, badge, prezzo, color, dimColor, midColor, icon, cardBg }) {
  const SIZE=74, SW=4.5;
  const r=(SIZE-SW*2)/2, cx=SIZE/2;
  const circ=2*Math.PI*r;
  const progressDash=circ*Math.min(pct/100, 1);
  return (
    <div style={{ background:cardBg, border:`1px solid ${midColor}`, borderRadius:15, padding:"11px 6px 11px 8px", display:"flex", alignItems:"center", gap:7, flex:1, minWidth:0 }}>
      <div style={{ position:"relative", width:SIZE, height:SIZE, flexShrink:0 }}>
        <svg width={SIZE} height={SIZE} style={{ position:"absolute", inset:0 }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={`${progressDash} ${circ}`} transform={`rotate(-90,${cx},${cx})`} />
        </svg>
        <div style={{ position:"absolute", top:SW*2+1, left:SW*2+1, right:SW*2+1, bottom:SW*2+1, borderRadius:"50%", background:dimColor, display:"flex", alignItems:"center", justifyContent:"center" }}>{icon}</div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ color:C.textDim, fontSize:9, margin:"0 0 0px", letterSpacing:2, textTransform:"uppercase", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{tipo}</p>
        {label && <p style={{ color:color, fontSize:9, margin:"0 0 1px", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</p>}
        <p style={{ color:C.text, fontSize:23, fontWeight:800, margin:"1px 0 0 -1px", fontFamily:"'Sora',sans-serif", letterSpacing:-1, lineHeight:1, whiteSpace:"nowrap" }}>{value}</p>
        <p style={{ color:C.textMid, fontSize:10, margin:"1px 0 2px", whiteSpace:"nowrap" }}>{unit}</p>
        {vsAnno && (() => {
          const [pct, ...rest] = vsAnno.split(" vs ");
          const anno = rest.join(" vs ");
          return (
            <p style={{ margin:"0 0 2px", whiteSpace:"nowrap" }}>
              <span style={{ color:color, fontSize:14, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>{pct}</span>
              {anno && <span style={{ color:C.textMid, fontSize:10, fontWeight:400, marginLeft:4 }}>vs {anno}</span>}
            </p>
          );
        })()}
        {badge && (
          <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:2 }}>
            <svg width="10" height="10" viewBox="0 0 10 10"><polyline points={badge.conveniente ? "1,3 5,7 9,3" : "1,7 5,3 9,7"} fill="none" stroke={badge.conveniente ? C.green : C.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ color:badge.conveniente ? C.green : C.red, fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>{badge.label}</span>
          </div>
        )}
        <p style={{ color:C.textDim, fontSize:9, margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{prezzo}</p>
      </div>
    </div>
  );
}

const XAXIS_H = 20;
const LUCE_H = 148, LUCE_M = { top:52, right:16, left:16, bottom:6 };
const LUCE_PH = LUCE_H - LUCE_M.top - LUCE_M.bottom - XAXIS_H;

function LuceChart({ data, label }) {
  const wrapRef = useRef();
  const [activeIdx, setActiveIdx] = useState(null);
  const MAX_KWH = Math.max(...data.map(d=>d.kwh), 1);

  const getIdx = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const innerW = rect.width - LUCE_M.left - LUCE_M.right;
    const step = innerW / data.length;
    const x = clientX - rect.left - LUCE_M.left;
    const idx = Math.floor(x / step);
    return idx >= 0 && idx < data.length ? idx : null;
  };

  const onMouseMove  = (e) => setActiveIdx(getIdx(e.clientX));
  const onMouseLeave = ()  => setActiveIdx(null);
  const onTouchMove  = (e) => { e.preventDefault(); setActiveIdx(getIdx(e.touches[0].clientX)); };
  const onTouchEnd   = ()  => setActiveIdx(null);

  const renderOverlay = () => {
    if (activeIdx===null) return null;
    const w = wrapRef.current?.offsetWidth ?? 320;
    const innerW = w - LUCE_M.left - LUCE_M.right;
    const step = innerW / data.length;
    const dotX = LUCE_M.left + activeIdx*step + step/2;
    const pct = data[activeIdx].kwh / MAX_KWH;
    const dotY = LUCE_M.top + (LUCE_PH * (1-pct));
    const bW=96, bH=30, bR=15, LIFT=26;
    const bX = Math.max(LUCE_M.left, Math.min(w-LUCE_M.right-bW, dotX-bW/2));
    const aTip = Math.max(bX+bR, Math.min(bX+bW-bR, dotX));
    const bY = dotY - LIFT - bH;
    const lineBottom = LUCE_H - XAXIS_H - 6;
    return (
      <svg style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }} width={w} height={LUCE_H}>
        {/* Linea verticale tratteggiata */}
        <line x1={dotX} y1={dotY+7} x2={dotX} y2={lineBottom}
          stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5} />
        {/* Punto attivo — bianco con bordo arancione */}
        <circle cx={dotX} cy={dotY} r={5} fill="white" stroke="#f59e0b" strokeWidth={2} />
        {/* Tooltip balloon */}
        <rect x={bX} y={bY} width={bW} height={bH} rx={bR} ry={bR} fill="#f59e0b" />
        <polygon points={`${aTip-5},${bY+bH-2} ${aTip+5},${bY+bH-2} ${aTip},${bY+bH+10}`} fill="#f59e0b" />
        <text x={bX+bW/2} y={bY+bH/2+5} textAnchor="middle" fill="black" fontWeight="800" fontSize="13" fontFamily="Sora,sans-serif">{data[activeIdx].kwh} kWh</text>
      </svg>
    );
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>⚡ Luce{label ? ` · ${label}` : ""}</p>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>Ultimi {data.length} mesi</p>
        </div>
        <span style={{ color:C.textDim, fontSize:11 }}>kWh</span>
      </div>
      <div ref={wrapRef} style={{ position:"relative", touchAction:"none", userSelect:"none" }}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <ResponsiveContainer width="100%" height={LUCE_H}>
          <AreaChart data={data} margin={LUCE_M}>
            <defs>
              <linearGradient id={`lgLuce${label||""}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="mese" axisLine={false} tickLine={false} height={XAXIS_H}
              tick={{ fill:"#4b5563", fontSize:9 }} interval={0} />
            <YAxis hide domain={[0, MAX_KWH*1.1]} />
            <Area type="natural" dataKey="kwh" stroke="#f59e0b" strokeWidth={2}
              fill={`url(#lgLuce${label||""})`} dot={false} activeDot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
        {renderOverlay()}
      </div>
    </div>
  );
}

const GAS_H = 156, GAS_M = { top:52, right:8, left:8, bottom:6 };
const GAS_PH = GAS_H - GAS_M.top - GAS_M.bottom - XAXIS_H;

function GasChart({ data, label }) {
  const wrapRef = useRef();
  const [activeIdx, setActiveIdx] = useState(null);
  const MAX_GAS = Math.max(...data.map(d=>d.smc), 1);

  const getIdx = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const innerW = rect.width - GAS_M.left - GAS_M.right;
    const step = innerW / data.length;
    const x = clientX - rect.left - GAS_M.left;
    const idx = Math.floor(x / step);
    return idx >= 0 && idx < data.length ? idx : null;
  };

  const onMouseMove  = (e) => setActiveIdx(getIdx(e.clientX));
  const onMouseLeave = ()  => setActiveIdx(null);
  const onTouchMove  = (e) => { e.preventDefault(); setActiveIdx(getIdx(e.touches[0].clientX)); };
  const onTouchEnd   = ()  => setActiveIdx(null);

  const PillBar = ({ x, y, width, height, index }) => {
    const r=Math.min(width/2, 7), isActive=index===activeIdx;
    return (
      <g>
        <rect x={x} y={GAS_M.top} width={width} height={Math.max(GAS_PH, r*2)} rx={r} ry={r} fill="#1c2a30" />
        <rect x={x} y={y} width={width} height={Math.max(height, r*2)} rx={r} ry={r}
          fill={isActive?"#7dd3fc":"#38bdf8"} />
      </g>
    );
  };

  const renderOverlay = () => {
    if (activeIdx===null) return null;
    const w = wrapRef.current?.offsetWidth ?? 320;
    const innerW = w - GAS_M.left - GAS_M.right;
    const step = innerW / data.length;
    const barCx = GAS_M.left + activeIdx*step + step/2;
    const value = data[activeIdx].smc;
    const bW=88, bH=30, bR=15, BY=5;
    const bX = Math.max(GAS_M.left, Math.min(w-GAS_M.right-bW, barCx-bW/2));
    const aTip = Math.max(bX+bR, Math.min(bX+bW-bR, barCx));
    return (
      <svg style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }} width={w} height={GAS_H}>
        <rect x={bX} y={BY} width={bW} height={bH} rx={bR} ry={bR} fill="#38bdf8" />
        <polygon points={`${aTip-5},${BY+bH-2} ${aTip+5},${BY+bH-2} ${aTip},${BY+bH+10}`} fill="#38bdf8" />
        <text x={bX+bW/2} y={BY+bH/2+5} textAnchor="middle" fill="white" fontWeight="800" fontSize="13" fontFamily="Sora,sans-serif">{value} Smc</text>
      </svg>
    );
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>🔥 Gas{label ? ` · ${label}` : ""}</p>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>Ultimi {data.length} mesi</p>
        </div>
        <span style={{ color:C.textDim, fontSize:11 }}>Smc</span>
      </div>
      <div ref={wrapRef} style={{ position:"relative", touchAction:"none", userSelect:"none" }}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <ResponsiveContainer width="100%" height={GAS_H}>
          <BarChart data={data} margin={GAS_M} barCategoryGap="22%">
            <XAxis dataKey="mese" axisLine={false} tickLine={false} height={XAXIS_H}
              tick={{ fill:"#4b5563", fontSize:9 }} interval={0} />
            <YAxis hide domain={[0, MAX_GAS*1.1]} />
            <Bar dataKey="smc" isAnimationActive={false} shape={<PillBar />} />
          </BarChart>
        </ResponsiveContainer>
        {renderOverlay()}
      </div>
    </div>
  );
}

function Dashboard({ user, dati, onGoUpload }) {
  if (!dati) {
    return (
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:300 }}>
        <p style={{ color:C.textDim, fontSize:14 }}>Caricamento...</p>
      </div>
    );
  }

  const { bollette, forniture } = dati;
  const hasDati = bollette.length > 0;

  // Raggruppa bollette per fornitura
  const bollettePerFornitura = (fornituraId) =>
    bollette.filter(b => b.fornitura_id === fornituraId)
            .sort((a,b) => new Date(a.periodo_fine) - new Date(b.periodo_fine));

  const spesaTotale = bollette.reduce((s,b) => s + Number(b.totale_pagare||0), 0);
  const nomeUtente  = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Utente";

  // Risparmio/extra-costo vs mercato (PUN/PSV) da dati
  const { indici = [] } = dati;
  const ultimoPUN = [...indici].filter(i => i.tipo_indice === "PUN").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];
  const ultimoPSV = [...indici].filter(i => i.tipo_indice === "PSV").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];
  const calcolaRisparmio = () => {
    if (!hasDati) return null;
    let totale = 0;
    let haCalcolo = false;
    forniture.forEach(f => {
      const bollF = bollettePerFornitura(f.id);
      const ultimaB = bollF[bollF.length - 1];
      const tariffa = parseFloat(ultimaB?.dati_estratti?.prezzo_materia_prima);
      const consumo = ultimaB?.dati_estratti?.consumo_annuo
        ? Number(ultimaB.dati_estratti.consumo_annuo)
        : bollF.reduce((s,b) => s + Number(b.consumo_fatturato||0), 0);
      const indice = f.tipo_utenza === "LUCE" ? ultimoPUN : ultimoPSV;
      if (tariffa && indice && consumo > 0) {
        totale += (tariffa - indice.valore_medio) * consumo;
        haCalcolo = true;
      }
    });
    if (!haCalcolo) return null;
    return Math.round(totale); // positivo = spendi di più vs mercato, negativo = risparmi
  };
  const risparmioVsMercato = calcolaRisparmio();
  // Label periodo: se abbiamo consumo_annuo usiamo "anno", altrimenti "periodo"
  const periodoLabel = "anno";

  // Ultime bollette
  const ultimeBollette = [...bollette]
    .sort((a,b) => new Date(b.data_emissione||b.periodo_fine) - new Date(a.data_emissione||a.periodo_fine))
    .slice(0, 5);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, paddingBottom:8 }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#1a0f00 0%,${C.surface} 60%)`, borderRadius:20, padding:"20px 20px 16px", border:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:140, height:140, borderRadius:"50%", background:`radial-gradient(circle,${C.amberDim} 0%,transparent 70%)` }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Ciao,</p>
            <h1 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif", letterSpacing:-0.5 }}>{nomeUtente}</h1>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }} />
              <span style={{ color:C.textMid, fontSize:12 }}>
                {hasDati ? "Pagamenti regolari · Milano" : "Aggiungi le tue bollette"}
              </span>
            </div>
          </div>
          <button style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, padding:10, cursor:"pointer" }}>
            <Bell size={18} color={C.textDim} />
          </button>
        </div>
        <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
          <p style={{ color:C.textDim, fontSize:11, margin:"0 0 4px", letterSpacing:1, textTransform:"uppercase" }}>
            {hasDati ? "Spesa annua totale" : "Nessun dato ancora"}
          </p>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap" }}>
            <span style={{ color:C.text, fontSize:32, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
              {hasDati ? Math.round(spesaTotale).toLocaleString("it-IT") : "—"}
            </span>
            {hasDati && <span style={{ color:C.textMid, fontSize:16 }}>€</span>}
            {risparmioVsMercato !== null && (() => {
              const risparmia = risparmioVsMercato < 0;
              const val = Math.abs(risparmioVsMercato);
              const colore = risparmia ? C.green : C.red;
              return (
                <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <polyline points={risparmia ? "1,4 6,9 11,4" : "1,8 6,3 11,8"}
                      fill="none" stroke={colore} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ color:colore, fontSize:11, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>
                    {risparmia ? `risparmi ~${val.toLocaleString("it-IT")}€/${periodoLabel}` : `spendi ~${val.toLocaleString("it-IT")}€/${periodoLabel} in più`}
                  </span>
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {!hasDati && <EmptyState onGoUpload={onGoUpload} />}

      {/* Ring cards: sempre Luce a sinistra, Gas a destra */}
      {(() => {
        const forLuce = forniture.filter(f => f.tipo_utenza === "LUCE");
        const forGas  = forniture.filter(f => f.tipo_utenza === "GAS");
        const righe   = Math.max(forLuce.length, forGas.length, 1);
        const makeCard = (f, isLuce) => {
          const bollF     = f ? bollettePerFornitura(f.id) : [];
          const benchmark = isLuce ? BENCHMARK_LUCE_MESE : BENCHMARK_GAS_MESE;
          const pct       = f ? calcPct(bollF, benchmark) : 2;
          const ultimaB      = bollF[bollF.length-1];
          const consumoAnnuoB = ultimaB?.dati_estratti?.consumo_annuo;
          const totale       = consumoAnnuoB
            ? Number(consumoAnnuoB)
            : bollF.reduce((s,b) => s + Number(b.consumo_fatturato||0), 0);
          const prezzo    = ultimaB?.dati_estratti?.prezzo_materia_prima;
          const multiLine = isLuce ? forLuce.length > 1 : forGas.length > 1;
          const label     = f && multiLine ? (f.nickname ?? f.fornitore ?? f.pod_pdr) : null;

          // vsAnno: confronto consumo anno corrente vs anno precedente
          const annoCorr = new Date().getFullYear();
          const annoPre  = annoCorr - 1;
          const consCurr = bollF.filter(b => b.periodo_fine && new Date(b.periodo_fine).getFullYear() === annoCorr)
                               .reduce((s,b) => s + Number(b.consumo_fatturato||0), 0);
          const consPrev = bollF.filter(b => b.periodo_fine && new Date(b.periodo_fine).getFullYear() === annoPre)
                               .reduce((s,b) => s + Number(b.consumo_fatturato||0), 0);
          const vsAnnoStr = (consCurr > 0 && consPrev > 0)
            ? (() => {
                const pctDiff = ((consCurr - consPrev) / consPrev) * 100;
                const sign    = pctDiff > 0 ? "+" : "";
                return `${sign}${Math.round(pctDiff)}% vs ${annoPre}`;
              })()
            : null;

          // badge "Conveniente" se prezzo < PUN/PSV di mercato
          const indici     = dati?.indici ?? [];
          const ultimoInd  = [...indici].filter(i => i.tipo_indice === (isLuce?"PUN":"PSV"))
                                         .sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];
          const tariffaNum = prezzo ? parseFloat(prezzo) : null;
          const conveniente = tariffaNum && ultimoInd && tariffaNum < ultimoInd.valore_medio;
          const badge = (tariffaNum && ultimoInd)
            ? { label: conveniente ? "Conveniente" : "Costoso", conveniente }
            : null;

          return (
            <RingCard
              key={f?.id ?? (isLuce ? "empty-luce" : "empty-gas")}
              tipo={isLuce ? "Luce" : "Gas"}
              label={label}
              value={f ? Math.round(totale).toLocaleString("it-IT") : "0"}
              unit={isLuce ? "kWh/anno" : "Smc/anno"}
              pct={pct}
              vsAnno={vsAnnoStr}
              badge={f && badge}
              prezzo={f
                ? (prezzo ? `${prezzo} €/${isLuce?"kWh":"Smc"}` : (f.nickname ?? f.fornitore ?? "—"))
                : "Nessuna bolletta"}
              color={isLuce ? C.amber : C.sky}
              dimColor={isLuce ? C.amberDim : C.skyDim}
              midColor={isLuce ? C.amberMid : C.skyMid}
              icon={isLuce ? <Zap size={18} color={C.amber}/> : <Flame size={18} color={C.sky}/>}
              cardBg={isLuce
                ? `linear-gradient(135deg,#1a0f00,${C.surface})`
                : `linear-gradient(135deg,#001824,${C.surface})`}
            />
          );
        };
        return Array.from({ length: righe }).map((_, i) => (
          <div key={i} style={{ display:"flex", gap:10 }}>
            {makeCard(forLuce[i] ?? null, true)}
            {makeCard(forGas[i]  ?? null, false)}
          </div>
        ));
      })()}

      {/* Grafici: prima Luce, poi Gas, ordine fisso */}
      {[
        ...forniture.filter(f => f.tipo_utenza === "LUCE"),
        ...forniture.filter(f => f.tipo_utenza === "GAS"),
      ].map(f => {
        const isLuce    = f.tipo_utenza === "LUCE";
        const bollF     = bollettePerFornitura(f.id);
        const multiLine = forniture.filter(x => x.tipo_utenza === f.tipo_utenza).length > 1;
        const label     = multiLine ? (f.nickname ?? f.fornitore) : null;

        if (bollF.length === 0) {
          return (
            <div key={f.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20 }}>
              <p style={{ color:isLuce?C.amber:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 6px", textTransform:"uppercase" }}>
                {isLuce ? "⚡ Luce" : "🔥 Gas"}{label ? ` · ${label}` : ""}
              </p>
              <p style={{ color:C.textDim, fontSize:12, margin:0 }}>
                Carica la prima bolletta per vedere il grafico
              </p>
            </div>
          );
        }

        const chartData = buildChartDataFromStorico(bollF, f.tipo_utenza);
        return isLuce
          ? <LuceChart key={f.id} data={chartData} label={label} />
          : <GasChart  key={f.id} data={chartData} label={label} />;
      })}


      {/* Ultime bollette */}
      {ultimeBollette.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Ultime bollette</p>
          {ultimeBollette.map((b, i) => {
            const isLuce = b.forniture?.tipo_utenza === "LUCE";
            const color  = isLuce ? C.amber : C.sky;
            const dim    = isLuce ? C.amberDim : C.skyDim;
            const icon   = isLuce ? <Zap size={14} color={color}/> : <Flame size={14} color={color}/>;
            return (
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface2, borderRadius:14, padding:"13px 14px", marginBottom:i<ultimeBollette.length-1?10:0, border:`1px solid ${C.border2}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ background:dim, borderRadius:10, padding:9 }}>{icon}</div>
                  <div>
                    <p style={{ color:C.text, fontSize:13, fontWeight:600, margin:0 }}>
                      {b.forniture?.tipo_utenza} · {b.forniture?.fornitore}
                    </p>
                    <p style={{ color:C.textDim, fontSize:11, margin:"2px 0 0" }}>
                      {meseFmt(b.periodo_inizio)} – {meseFmt(b.periodo_fine)} {b.periodo_fine ? new Date(b.periodo_fine).getFullYear() : ""}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:C.text, fontSize:16, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>
                    {n2(b.totale_pagare)} €
                  </p>
                  <span style={{ background:C.greenDim, color:C.green, fontSize:10, borderRadius:20, padding:"2px 8px", fontWeight:600 }}>
                    {b.stato}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MercatoScreen({ dati }) {
  const { indici = [], forniture = [], bollette = [] } = dati ?? {};

  // Ultimi PUN e PSV disponibili
  const pun = [...indici].filter(i => i.tipo_indice === "PUN").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];
  const psv = [...indici].filter(i => i.tipo_indice === "PSV").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];

  // Prezzo fisso dalla bolletta più recente (per tipo)
  const ultimaBollettaLuce = [...bollette].filter(b => b.forniture?.tipo_utenza === "LUCE")
    .sort((a,b) => new Date(b.periodo_fine) - new Date(a.periodo_fine))[0];
  const ultimaBollettaGas  = [...bollette].filter(b => b.forniture?.tipo_utenza === "GAS")
    .sort((a,b) => new Date(b.periodo_fine) - new Date(a.periodo_fine))[0];

  const tariffaLuce = parseFloat(ultimaBollettaLuce?.dati_estratti?.prezzo_materia_prima) || null;
  const tariffaGas  = parseFloat(ultimaBollettaGas?.dati_estratti?.prezzo_materia_prima)  || null;

  // Consumo annuo stimato (somma bollette)
  const consumoLuceAnnuo = bollette.filter(b => b.forniture?.tipo_utenza === "LUCE")
    .reduce((s,b) => s + Number(b.consumo_fatturato||0), 0);
  const consumoGasAnnuo  = bollette.filter(b => b.forniture?.tipo_utenza === "GAS")
    .reduce((s,b) => s + Number(b.consumo_fatturato||0), 0);

  // Delta: positivo = mercato più economico (potrei risparmiare), negativo = la mia tariffa è più economica
  const deltaLuce = (pun && tariffaLuce) ? tariffaLuce - pun.valore_medio : null;
  const deltaGas  = (psv && tariffaGas)  ? tariffaGas  - psv.valore_medio  : null;

  // Risparmio/perdita annua stimata
  const risparmioLuce = (deltaLuce !== null && consumoLuceAnnuo) ? deltaLuce * consumoLuceAnnuo : null;
  const risparmioGas  = (deltaGas  !== null && consumoGasAnnuo)  ? deltaGas  * consumoGasAnnuo  : null;

  const IndiceCard = ({ label, icon, color, dim, mid, bg, mercato, tariffa, unit, delta, risparmio, consumoAnnuo, mese }) => {
    const hasTariffa = tariffa !== null;
    const risparmioPositivo = risparmio > 0;
    return (
      <div style={{ background:bg, border:`1px solid ${mid}`, borderRadius:20, padding:20 }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <div style={{ background:dim, borderRadius:8, padding:6 }}>{icon}</div>
          <span style={{ color:color, fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" }}>{label}</span>
          {mese && <span style={{ background:dim, color:color, fontSize:10, fontWeight:700, borderRadius:20, padding:"2px 8px" }}>{mese}</span>}
        </div>
        {/* Valore mercato */}
        <p style={{ color:C.text, fontSize:34, fontWeight:800, margin:"0 0 2px", fontFamily:"'Sora',sans-serif" }}>
          {mercato !== null ? Number(mercato).toFixed(4) : "—"}
          {" "}<span style={{ fontSize:14, color:C.textMid }}>{unit}</span>
        </p>
        <p style={{ color:C.textDim, fontSize:11, margin:"0 0 14px" }}>Prezzo mercato all'ingrosso</p>
        {/* Confronto tariffa */}
        {hasTariffa && mercato !== null ? (
          <div style={{ borderTop:`1px solid ${mid}`, paddingTop:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ color:C.textMid, fontSize:12 }}>La tua tariffa</span>
              <span style={{ color:C.text, fontSize:14, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>
                {Number(tariffa).toFixed(4)} {unit}
              </span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ color:C.textMid, fontSize:12 }}>Differenza</span>
              <span style={{ color: delta > 0 ? C.red : C.green, fontSize:14, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
                {delta > 0 ? "+" : ""}{Number(delta).toFixed(4)} {unit}
              </span>
            </div>
            {/* Stima risparmio annuo */}
            {consumoAnnuo > 0 && (
              <div style={{
                background: risparmioPositivo ? C.redDim : C.greenDim,
                borderRadius:12, padding:"12px 14px",
                display:"flex", justifyContent:"space-between", alignItems:"center"
              }}>
                <div>
                  <p style={{ color:C.textMid, fontSize:11, margin:"0 0 2px" }}>
                    {risparmioPositivo ? "Spendi in più vs mercato" : "Risparmi vs mercato"}
                  </p>
                  <p style={{ color:risparmioPositivo ? C.red : C.green, fontSize:9, margin:0 }}>
                    {Math.round(consumoAnnuo).toLocaleString("it-IT")} {unit === "€/kWh" ? "kWh" : "Smc"} × {Math.abs(delta).toFixed(4)}
                  </p>
                </div>
                <span style={{ color: risparmioPositivo ? C.red : C.green, fontSize:20, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
                  {risparmioPositivo ? "+" : "-"}{Math.abs(Math.round(risparmio)).toLocaleString("it-IT")} €
                </span>
              </div>
            )}
          </div>
        ) : hasTariffa ? (
          <p style={{ color:C.textDim, fontSize:12, marginTop:8 }}>Aggiorna gli indici di mercato per vedere il confronto</p>
        ) : (
          <p style={{ color:C.textDim, fontSize:12, marginTop:8 }}>Carica una bolletta per vedere il confronto con la tua tariffa</p>
        )}
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:8 }}>
      <div>
        <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Indici</p>
        <h2 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>Mercato</h2>
      </div>

      <IndiceCard
        label="PUN · Luce" icon={<Zap size={14} color={C.amber}/>}
        color={C.amber} dim={C.amberDim} mid={C.amberMid}
        bg={`linear-gradient(135deg,#1a0f00,${C.surface})`}
        mercato={pun?.valore_medio ?? null} tariffa={tariffaLuce} unit="€/kWh"
        delta={deltaLuce} risparmio={risparmioLuce} consumoAnnuo={consumoLuceAnnuo}
        mese={pun ? meseFmt(pun.mese_anno) : ""}
      />
      <IndiceCard
        label="PSV · Gas" icon={<Flame size={14} color={C.sky}/>}
        color={C.sky} dim={C.skyDim} mid={C.skyMid}
        bg={`linear-gradient(135deg,#001824,${C.surface})`}
        mercato={psv?.valore_medio ?? null} tariffa={tariffaGas} unit="€/Smc"
        delta={deltaGas} risparmio={risparmioGas} consumoAnnuo={consumoGasAnnuo}
        mese={psv ? meseFmt(psv.mese_anno) : ""}
      />

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.textMid, fontSize:12, fontWeight:600, margin:"0 0 2px" }}>Fonte dati</p>
          <p style={{ color:C.textDim, fontSize:11, margin:0 }}>GME · Aggiornamento giornaliero</p>
        </div>
        <ArrowUpRight size={16} color={C.textDim} />
      </div>
    </div>
  );
}

function SettingsScreen({ user, dati, onSignOut, onRefresh }) {
  const { forniture = [], bollette = [], indici = [] } = dati ?? {};
  const nomeUtente = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Utente";
  const email = user?.email ?? "";

  const [deletingId, setDeletingId] = useState(null);
  const [editingId,  setEditingId]  = useState(null);
  const [editValue,  setEditValue]  = useState("");
  const [loading,    setLoading]    = useState(false);

  const tuttiOrdinate = [...bollette]
    .sort((a,b) => new Date(b.data_emissione||b.periodo_fine) - new Date(a.data_emissione||a.periodo_fine));

  const eliminaBolletta = async (id) => {
    setLoading(true);
    // Trova la fornitura della bolletta prima di eliminarla
    const bolletta = bollette.find(b => b.id === id);
    const fornituraId = bolletta?.fornitura_id;
    // Elimina la bolletta
    await supabase.from("bollette").delete().eq("id", id);
    // Se era l'ultima bolletta di quella fornitura, elimina anche la fornitura
    if (fornituraId) {
      const rimaste = bollette.filter(b => b.id !== id && b.fornitura_id === fornituraId);
      if (rimaste.length === 0) {
        await supabase.from("forniture").delete().eq("id", fornituraId);
      }
    }
    setDeletingId(null);
    setLoading(false);
    onRefresh?.();
  };

  const salvaNickname = async (fornituraId) => {
    setLoading(true);
    await supabase.from("forniture").update({ nickname: editValue || null }).eq("id", fornituraId);
    setEditingId(null);
    setLoading(false);
    onRefresh?.();
  };

  // Ultimi indici salvati
  const ultimoPUN = [...indici].filter(i => i.tipo_indice === "PUN").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];
  const ultimoPSV = [...indici].filter(i => i.tipo_indice === "PSV").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:8 }}>
      <div>
        <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Profilo</p>
        <h2 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>Impostazioni</h2>
      </div>

      {/* Avatar */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20, display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${C.amber},#ef4444)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fff", flexShrink:0 }}>
          {nomeUtente.slice(0,2).toUpperCase()}
        </div>
        <div>
          <p style={{ color:C.text, fontSize:16, fontWeight:700, margin:"0 0 3px", fontFamily:"'Sora',sans-serif" }}>{nomeUtente}</p>
          <p style={{ color:C.textDim, fontSize:12, margin:"0 0 6px" }}>{email}</p>
          <span style={{ background:C.greenDim, color:C.green, fontSize:10, borderRadius:20, padding:"3px 10px", fontWeight:700 }}>Account attivo</span>
        </div>
      </div>

      {/* Indici mercato — sola visualizzazione, aggiornamento via GitHub Action */}
      {(ultimoPUN || ultimoPSV) && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>Indici mercato</p>
            <span style={{ background:C.greenDim, color:C.green, fontSize:10, fontWeight:700, borderRadius:20, padding:"3px 10px" }}>Aggiornamento automatico</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {ultimoPUN && (
              <div style={{ flex:1, background:C.amberDim, borderRadius:10, padding:"8px 10px" }}>
                <p style={{ color:C.textDim, fontSize:9, margin:"0 0 2px", textTransform:"uppercase", letterSpacing:1 }}>PUN {meseFmt(ultimoPUN.mese_anno)}</p>
                <p style={{ color:C.amber, fontSize:14, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>{Number(ultimoPUN.valore_medio).toFixed(4)} €/kWh</p>
              </div>
            )}
            {ultimoPSV && (
              <div style={{ flex:1, background:C.skyDim, borderRadius:10, padding:"8px 10px" }}>
                <p style={{ color:C.textDim, fontSize:9, margin:"0 0 2px", textTransform:"uppercase", letterSpacing:1 }}>PSV {meseFmt(ultimoPSV.mese_anno)}</p>
                <p style={{ color:C.sky, fontSize:14, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>{Number(ultimoPSV.valore_medio).toFixed(4)} €/Smc</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forniture con nickname */}
      {forniture.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Le tue forniture</p>
          {forniture.map((f, i) => {
            const isLuce    = f.tipo_utenza === "LUCE";
            const color     = isLuce ? C.amber : C.sky;
            const dim       = isLuce ? C.amberDim : C.skyDim;
            const icon      = isLuce ? <Zap size={14} color={color}/> : <Flame size={14} color={color}/>;
            const isEditing = editingId === f.id;
            return (
              <div key={f.id} style={{ background:C.surface2, borderRadius:14, padding:14, border:`1px solid ${C.border2}`, marginBottom:i<forniture.length-1?10:0 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ background:dim, borderRadius:8, padding:7 }}>{icon}</div>
                    <div>
                      <span style={{ color:color, fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>{f.tipo_utenza}</span>
                      {f.nickname && <p style={{ color:C.textMid, fontSize:11, margin:"2px 0 0" }}>{f.nickname}</p>}
                    </div>
                  </div>
                  <button onClick={() => { setEditingId(f.id); setEditValue(f.nickname||""); }}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:6 }}>
                    <Pencil size={14} color={C.textDim} />
                  </button>
                </div>
                {isEditing && (
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    <input value={editValue} onChange={e => setEditValue(e.target.value)}
                      placeholder="es. Casa Milano"
                      style={{ flex:1, background:C.bg, border:`1px solid ${C.border2}`, borderRadius:10, padding:"8px 12px", color:C.text, fontSize:13, outline:"none" }} />
                    <button onClick={() => salvaNickname(f.id)} disabled={loading}
                      style={{ background:C.green, border:"none", borderRadius:10, padding:"8px 12px", cursor:"pointer" }}>
                      <Check size={14} color="#fff" />
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:10, padding:"8px 12px", cursor:"pointer" }}>
                      <X size={14} color={C.textDim} />
                    </button>
                  </div>
                )}
                {[["Codice", f.pod_pdr], ["Fornitore", f.fornitore], ["Offerta", f.nome_offerta], ["Scadenza", f.data_scadenza_offerta]].filter(([,v]) => v).map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ color:C.textDim, fontSize:12 }}>{k}</span>
                    <span style={{ color:C.text, fontSize:12, fontWeight:600, fontFamily:k==="Codice"?"monospace":"inherit" }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Lista bollette con elimina */}
      {tuttiOrdinate.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Bollette salvate</p>
          {tuttiOrdinate.map((b, i) => {
            const isLuce  = b.forniture?.tipo_utenza === "LUCE";
            const color   = isLuce ? C.amber : C.sky;
            const dim     = isLuce ? C.amberDim : C.skyDim;
            const icon    = isLuce ? <Zap size={13} color={color}/> : <Flame size={13} color={color}/>;
            const isConf  = deletingId === b.id;
            return (
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface2, borderRadius:14, padding:"12px 14px", marginBottom:i<tuttiOrdinate.length-1?8:0, border:`1px solid ${isConf ? C.red+"44" : C.border2}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ background:dim, borderRadius:8, padding:7 }}>{icon}</div>
                  <div>
                    <p style={{ color:C.text, fontSize:12, fontWeight:600, margin:0 }}>
                      {b.forniture?.tipo_utenza} · {b.forniture?.fornitore}
                    </p>
                    <p style={{ color:C.textDim, fontSize:11, margin:"2px 0 0" }}>
                      {meseFmt(b.periodo_inizio)}-{meseFmt(b.periodo_fine)} {b.periodo_fine ? new Date(b.periodo_fine).getFullYear() : ""} · {n2(b.totale_pagare)} €
                    </p>
                  </div>
                </div>
                {isConf ? (
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => eliminaBolletta(b.id)} disabled={loading}
                      style={{ background:C.red, border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:11, color:"#fff", fontWeight:700 }}>
                      Elimina
                    </button>
                    <button onClick={() => setDeletingId(null)}
                      style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:8, padding:"6px 10px", cursor:"pointer" }}>
                      <X size={12} color={C.textDim} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeletingId(b.id)}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:6 }}>
                    <Trash2 size={15} color={C.textDim} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onSignOut} style={{ background:C.surface, border:`1px solid #ef444440`, borderRadius:16, padding:16, cursor:"pointer", color:"#ef4444", fontSize:14, fontWeight:600, textAlign:"center" }}>
        Esci dall'account
      </button>
    </div>
  );
}


export default function AppShell({ user, dati, onSignOut, onRefresh }) {
  const [tab, setTab] = useState("home");

  const nav = [
    { id:"home",     icon:Home,      label:"Home"     },
    { id:"upload",   icon:Upload,    label:"Bollette" },
    { id:"mercato",  icon:BarChart2, label:"Mercato"  },
    { id:"settings", icon:Settings,  label:"Profilo"  },
  ];

  return (
    <div style={{ display:"flex", justifyContent:"center", background:"#050505", minHeight:"100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
        body { background:#050505; }
      `}</style>
      <div style={{ width:"100%", maxWidth:430, minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ height:44, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", flexShrink:0 }}>
          <span style={{ color:C.textDim, fontSize:12, fontWeight:600 }}>
            {new Date().toLocaleTimeString("it-IT", { hour:"2-digit", minute:"2-digit" })}
          </span>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ display:"flex", gap:2 }}>{[3,4,5,6].map(h=><div key={h} style={{ width:3, height:h, background:C.textMid, borderRadius:1 }}/>)}</div>
            <div style={{ width:16, height:8, border:`1.5px solid ${C.textMid}`, borderRadius:2, position:"relative" }}>
              <div style={{ position:"absolute", right:-4, top:"50%", transform:"translateY(-50%)", width:3, height:4, background:C.textMid, borderRadius:"0 1px 1px 0" }} />
              <div style={{ width:"70%", height:"100%", background:C.green, borderRadius:1 }} />
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px 16px 100px" }}>
          {tab==="home"     && <Dashboard user={user} dati={dati} onGoUpload={() => setTab("upload")} />}
          {tab==="upload"   && <UploadScreen user={user} onBollettaSaved={() => { onRefresh(); setTab("home"); }} />}
          {tab==="mercato"  && <MercatoScreen dati={dati} />}
          {tab==="settings" && <SettingsScreen user={user} dati={dati} onSignOut={onSignOut} onRefresh={onRefresh} />}
        </div>
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:`${C.surface}ee`, backdropFilter:"blur(20px)", borderTop:`1px solid ${C.border}`, padding:"8px 8px 20px", display:"flex", justifyContent:"space-around", zIndex:100 }}>
          {nav.map(({ id, icon:Icon, label }) => {
            const active = tab===id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", padding:"8px 4px", borderRadius:14 }}>
                <div style={{ background:active?C.amberDim:"transparent", borderRadius:12, padding:"6px 16px", transition:"all 0.2s" }}>
                  <Icon size={20} color={active?C.amber:C.textDim} strokeWidth={active?2.5:1.5} />
                </div>
                <span style={{ fontSize:10, fontWeight:active?700:400, color:active?C.amber:C.textDim }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
