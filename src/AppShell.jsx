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

function buildChartData(bollette, valueKey, maxItems = 16) {
  return [...bollette]
    .sort((a,b) => new Date(a.periodo_fine) - new Date(b.periodo_fine))
    .slice(-maxItems)
    .map(b => ({
      mese: meseFmt(b.periodo_fine),
      [valueKey]: Number(b.consumo_fatturato) || 0,
    }));
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

function RingCard({ tipo, label, value, unit, pct, prezzo, color, dimColor, midColor, icon, cardBg }) {
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
        <p style={{ color:C.textMid, fontSize:10, margin:"1px 0 3px", whiteSpace:"nowrap" }}>{unit}</p>
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
    return (
      <svg style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }} width={w} height={LUCE_H}>
        <circle cx={dotX} cy={dotY} r={5} fill="#f59e0b" />
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
              fill={`url(#lgLuce${label||""})`} dot={false} isAnimationActive={false} />
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
            {hasDati ? "Spesa totale bollette" : "Nessun dato ancora"}
          </p>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <span style={{ color:C.text, fontSize:32, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
              {hasDati ? Math.round(spesaTotale).toLocaleString("it-IT") : "—"}
            </span>
            {hasDati && <span style={{ color:C.textMid, fontSize:16 }}>€</span>}
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
          const totale    = bollF.reduce((s,b) => s + Number(b.consumo_fatturato||0), 0);
          const ultimaB   = bollF[bollF.length-1];
          const prezzo    = ultimaB?.dati_estratti?.prezzo_materia_prima;
          const multiLine = isLuce ? forLuce.length > 1 : forGas.length > 1;
          const label     = f && multiLine ? (f.nickname ?? f.fornitore ?? f.pod_pdr) : null;
          return (
            <RingCard
              key={f?.id ?? (isLuce ? "empty-luce" : "empty-gas")}
              tipo={isLuce ? "Luce" : "Gas"}
              label={label}
              value={f ? Math.round(totale).toLocaleString("it-IT") : "0"}
              unit={isLuce ? "kWh totali" : "Smc totali"}
              pct={pct}
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
        if (bollF.length >= 2) {
          const chartData = buildChartData(bollF, isLuce ? "kwh" : "smc");
          return isLuce
            ? <LuceChart key={f.id} data={chartData} label={label} />
            : <GasChart  key={f.id} data={chartData} label={label} />;
        }
        return (
          <div key={f.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20 }}>
            <p style={{ color:isLuce?C.amber:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 6px", textTransform:"uppercase" }}>
              {isLuce ? "⚡ Luce" : "🔥 Gas"}{label ? ` · ${label}` : ""}
            </p>
            <p style={{ color:C.textDim, fontSize:12, margin:0 }}>
              {bollF.length === 0 ? "Carica le prime bollette per vedere il grafico" : "Carica almeno 2 bollette per vedere il grafico"}
            </p>
          </div>
        );
      })}

      {forniture.filter(f => f.tipo_utenza === "LUCE").length === 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20 }}>
          <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 6px", textTransform:"uppercase" }}>⚡ Luce</p>
          <p style={{ color:C.textDim, fontSize:12, margin:0 }}>Carica le prime bollette per vedere il grafico</p>
        </div>
      )}
      {forniture.filter(f => f.tipo_utenza === "GAS").length === 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20 }}>
          <p style={{ color:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 6px", textTransform:"uppercase" }}>🔥 Gas</p>
          <p style={{ color:C.textDim, fontSize:12, margin:0 }}>Carica le prime bollette per vedere il grafico</p>
        </div>
      )}

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

function buildChartData(bollette, valueKey, maxItems = 16) {
  return [...bollette]
    .sort((a,b) => new Date(a.periodo_fine) - new Date(b.periodo_fine))
    .slice(-maxItems)
    .map(b => ({
      mese: meseFmt(b.periodo_fine),
      [valueKey]: Number(b.consumo_fatturato) || 0,
    }));
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

function RingCard({ tipo, label, value, unit, pct, prezzo, color, dimColor, midColor, icon, cardBg }) {
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
        <p style={{ color:C.textMid, fontSize:10, margin:"1px 0 3px", whiteSpace:"nowrap" }}>{unit}</p>
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
    return (
      <svg style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }} width={w} height={LUCE_H}>
        <circle cx={dotX} cy={dotY} r={5} fill="#f59e0b" />
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
              fill={`url(#lgLuce${label||""})`} dot={false} isAnimationActive={false} />
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
            {hasDati ? "Spesa totale bollette" : "Nessun dato ancora"}
          </p>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <span style={{ color:C.text, fontSize:32, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
              {hasDati ? Math.round(spesaTotale).toLocaleString("it-IT") : "—"}
            </span>
            {hasDati && <span style={{ color:C.textMid, fontSize:16 }}>€</span>}
          </div>
        </div>
      </div>

