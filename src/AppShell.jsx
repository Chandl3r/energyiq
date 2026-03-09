// src/AppShell.jsx
import { useState, useRef } from "react";
import UploadScreen from "./components/UploadScreen";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  Zap, Flame, Home, Upload, BarChart2, Settings,
  CheckCircle, ChevronRight, Bell, RefreshCw, ArrowUpRight, TrendingUp, CloudUpload
} from "lucide-react";

const C = {
  bg:"#080808", surface:"#111111", surface2:"#181818",
  border:"#1e1e1e", border2:"#252525",
  amber:"#f59e0b", amberDim:"#f59e0b20", amberMid:"#f59e0b40",
  sky:"#38bdf8",   skyDim:"#38bdf820",   skyMid:"#38bdf840",
  green:"#22c55e", greenDim:"#22c55e18",
  red:"#ef4444", text:"#ffffff", textMid:"#9ca3af", textDim:"#4b5563",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function meseFmt(isoDate) {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleDateString("it-IT", { month:"short" })
      .replace(".","").replace(/^\w/, c => c.toUpperCase());
  } catch { return ""; }
}

function n2(v) { return v != null ? Number(v).toFixed(2) : "—"; }

// Dato un array di bollette filtrate per tipo, costruisce i dati per il grafico
// ordinati per periodo_fine, massimo ultimi N mesi
function buildChartData(bollette, valueKey, maxItems = 16) {
  return bollette
    .slice(-maxItems)
    .map(b => ({
      mese:  meseFmt(b.periodo_fine),
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

function RingCard({ tipo, value, unit, pct, vsYear, prezzo, color, dimColor, midColor, icon, cardBg }) {
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
        <p style={{ color:C.textDim, fontSize:9, margin:"0 0 0px", letterSpacing:2, textTransform:"uppercase", fontWeight:600, whiteSpace:"nowrap" }}>{tipo}</p>
        <p style={{ color:C.text, fontSize:23, fontWeight:800, margin:"1px 0 0 -1px", fontFamily:"'Sora',sans-serif", letterSpacing:-1, lineHeight:1, whiteSpace:"nowrap" }}>{value}</p>
        <p style={{ color:C.textMid, fontSize:10, margin:"1px 0 3px", whiteSpace:"nowrap" }}>{unit}</p>
        {vsYear && (
          <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:2, whiteSpace:"nowrap" }}>
            <span style={{ color:color, fontSize:14, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>{vsYear}</span>
          </div>
        )}
        <p style={{ color:C.textDim, fontSize:9, margin:0, whiteSpace:"nowrap" }}>{prezzo}</p>
      </div>
    </div>
  );
}

const XAXIS_H = 20;
const LUCE_H = 148, LUCE_M = { top:52, right:16, left:16, bottom:6 };
const LUCE_PH = LUCE_H - LUCE_M.top - LUCE_M.bottom - XAXIS_H;
const GAS_H = 156, GAS_M = { top:52, right:8, left:8, bottom:6 };
const GAS_PH = GAS_H - GAS_M.top - GAS_M.bottom - XAXIS_H;

function LuceChart({ data }) {
  const wrapRef = useRef(null);
  const [active, setActive] = useState(null);
  const MIN_KWH = Math.min(...data.map(d => d.kwh)) - 30;
  const MAX_KWH = Math.max(...data.map(d => d.kwh)) + 30;

  const getActive = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX  = clientX - rect.left;
    const innerW = rect.width - LUCE_M.left - LUCE_M.right;
    const n = data.length;
    const step = innerW / (n - 1);
    const idx = Math.max(0, Math.min(n-1, Math.round((relX - LUCE_M.left) / step)));
    const xPx = LUCE_M.left + idx * step;
    const yPx = LUCE_M.top + LUCE_PH * (1 - (data[idx].kwh - MIN_KWH) / (MAX_KWH - MIN_KWH));
    return { idx, xPx, yPx, value: data[idx].kwh };
  };

  const onMouseMove  = (e) => setActive(getActive(e.clientX));
  const onMouseLeave = ()  => setActive(null);
  const onTouchMove  = (e) => { e.preventDefault(); setActive(getActive(e.touches[0].clientX)); };
  const onTouchEnd   = ()  => setActive(null);

  const renderOverlay = () => {
    if (!active) return null;
    const { xPx, yPx, value } = active;
    const w = wrapRef.current?.offsetWidth ?? 320;
    const bW=96, bH=30, bR=15, LIFT=26;
    const topY = yPx - bH - LIFT;
    const bX = Math.max(LUCE_M.left, Math.min(w - LUCE_M.right - bW, xPx - bW/2));
    const aTip = Math.max(bX+bR, Math.min(bX+bW-bR, xPx));
    const lineBottom = LUCE_M.top + LUCE_PH - 1;
    return (
      <svg style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }} width={w} height={LUCE_H}>
        {(yPx + 6) < lineBottom && (
          <line x1={xPx} y1={yPx+6} x2={xPx} y2={lineBottom}
            stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} strokeLinecap="round" />
        )}
        <circle cx={xPx} cy={yPx} r={5.5} fill="white" stroke="#f59e0b" strokeWidth={2.5} />
        <rect x={bX} y={topY} width={bW} height={bH} rx={bR} ry={bR} fill="#f59e0b" />
        <polygon points={`${aTip-6},${topY+bH-2} ${aTip+6},${topY+bH-2} ${xPx},${yPx-8}`} fill="#f59e0b" />
        <text x={bX+bW/2} y={topY+bH/2+5} textAnchor="middle" fill="white" fontWeight="800" fontSize="13" fontFamily="Sora,sans-serif">{value} kWh</text>
      </svg>
    );
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>Luce</p>
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
              <linearGradient id="luceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="mese" axisLine={false} tickLine={false} height={XAXIS_H}
              tick={{ fill:"#4b5563", fontSize:9 }} interval={0} />
            <YAxis hide domain={[MIN_KWH, MAX_KWH]} />
            <Area type="natural" dataKey="kwh" stroke="#f59e0b" strokeWidth={2.5}
              fill="url(#luceGrad)" dot={false} activeDot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
        {renderOverlay()}
      </div>
    </div>
  );
}

function GasChart({ data }) {
  const wrapRef  = useRef(null);
  const [activeIdx, setActiveIdx] = useState(null);
  const MAX_GAS = Math.max(...data.map(d => d.smc));

  const getIdx = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX  = clientX - rect.left;
    const innerW = rect.width - GAS_M.left - GAS_M.right;
    const step   = innerW / data.length;
    return Math.max(0, Math.min(data.length-1, Math.floor((relX - GAS_M.left) / step)));
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
          <p style={{ color:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>Gas</p>
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

  // Separa bollette per tipo usando il join
  const bolletteLuce = bollette.filter(b => b.forniture?.tipo_utenza === "LUCE");
  const bolletteGas  = bollette.filter(b => b.forniture?.tipo_utenza === "GAS");

  const hasDati = bollette.length > 0;

  // Calcola stats
  const consumoLuce = bolletteLuce.reduce((s, b) => s + Number(b.consumo_fatturato || 0), 0);
  const consumoGas  = bolletteGas.reduce((s, b) => s + Number(b.consumo_fatturato || 0), 0);
  const spesaLuce   = bolletteLuce.reduce((s, b) => s + Number(b.totale_pagare || 0), 0);
  const spesaGas    = bolletteGas.reduce((s, b) => s + Number(b.totale_pagare || 0), 0);
  const spesaTotale = spesaLuce + spesaGas;

  // Ultima tariffa disponibile
  const ultimaBollettaLuce = bolletteLuce[bolletteLuce.length - 1];
  const ultimaBollettaGas  = bolletteGas[bolletteGas.length - 1];
  const prezzoLuce = ultimaBollettaLuce?.dati_estratti?.prezzo_materia_prima;
  const prezzoGas  = ultimaBollettaGas?.dati_estratti?.prezzo_materia_prima;

  // Fornitura info
  const fornituraLuce = forniture.find(f => f.tipo_utenza === "LUCE");
  const fornituraGas  = forniture.find(f => f.tipo_utenza === "GAS");

  // Dati grafici
  const luceChartData = buildChartData(bolletteLuce, "kwh", 15).map(d => ({ mese:d.mese, kwh:d.kwh }));
  const gasChartData  = buildChartData(bolletteGas,  "smc", 16).map(d => ({ mese:d.mese, smc:d.smc }));

  // Ultime bollette (max 5, più recenti)
  const ultimeBollette = [...bollette]
    .sort((a,b) => new Date(b.data_emissione) - new Date(a.data_emissione))
    .slice(0, 5);

  // Nome utente
  const nomeUtente = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Utente";

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

      {/* Empty state */}
      {!hasDati && <EmptyState onGoUpload={onGoUpload} />}

      {/* Ring cards */}
      {hasDati && (
        <div style={{ display:"flex", gap:10 }}>
          <RingCard
            tipo="Luce" value={Math.round(consumoLuce).toLocaleString("it-IT")} unit="kWh totali"
            pct={75} prezzo={prezzoLuce ? `${prezzoLuce} €/kWh` : fornituraLuce?.fornitore ?? "—"}
            color={C.amber} dimColor={C.amberDim} midColor={C.amberMid}
            icon={<Zap size={18} color={C.amber} />} cardBg={`linear-gradient(135deg,#1a0f00,${C.surface})`}
          />
          <RingCard
            tipo="Gas" value={Math.round(consumoGas).toLocaleString("it-IT")} unit="Smc totali"
            pct={54} prezzo={prezzoGas ? `${prezzoGas} €/Smc` : fornituraGas?.fornitore ?? "—"}
            color={C.sky} dimColor={C.skyDim} midColor={C.skyMid}
            icon={<Flame size={18} color={C.sky} />} cardBg={`linear-gradient(135deg,#001824,${C.surface})`}
          />
        </div>
      )}

      {/* Grafici luce */}
      {luceChartData.length >= 2 && <LuceChart data={luceChartData} />}
      {luceChartData.length === 1 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20 }}>
          <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 6px", textTransform:"uppercase" }}>Luce</p>
          <p style={{ color:C.textDim, fontSize:12, margin:0 }}>Carica almeno 2 bollette luce per vedere il grafico</p>
        </div>
      )}

      {/* Grafici gas */}
      {gasChartData.length >= 2 && <GasChart data={gasChartData} />}
      {gasChartData.length === 1 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20 }}>
          <p style={{ color:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 6px", textTransform:"uppercase" }}>Gas</p>
          <p style={{ color:C.textDim, fontSize:12, margin:0 }}>Carica almeno 2 bollette gas per vedere il grafico</p>
        </div>
      )}

      {/* Ultime bollette */}
      {ultimeBollette.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>Ultime bollette</p>
          </div>
          {ultimeBollette.map((b, i) => {
            const isLuce = b.forniture?.tipo_utenza === "LUCE";
            const color = isLuce ? C.amber : C.sky;
            const dim   = isLuce ? C.amberDim : C.skyDim;
            const icon  = isLuce ? <Zap size={14} color={color}/> : <Flame size={14} color={color}/>;
            return (
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface2, borderRadius:14, padding:"13px 14px", marginBottom:i<ultimeBollette.length-1?10:0, border:`1px solid ${C.border2}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ background:dim, borderRadius:10, padding:9 }}>{icon}</div>
                  <div>
                    <p style={{ color:C.text, fontSize:13, fontWeight:600, margin:0 }}>
                      {b.forniture?.tipo_utenza} · {b.forniture?.fornitore}
                    </p>
                    <p style={{ color:C.textDim, fontSize:11, margin:"2px 0 0" }}>
                      {meseFmt(b.periodo_inizio)} – {meseFmt(b.periodo_fine)} {new Date(b.periodo_fine).getFullYear()}
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
  const { indici = [] } = dati ?? {};

  // Ultimo PUN e PSV disponibili
  const pun = [...indici].filter(i => i.tipo_indice === "PUN").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];
  const psv = [...indici].filter(i => i.tipo_indice === "PSV").sort((a,b) => b.mese_anno.localeCompare(a.mese_anno))[0];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Live</p>
          <h2 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>Mercato</h2>
        </div>
        <button style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:10, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <RefreshCw size={14} color={C.textDim} />
          <span style={{ color:C.textDim, fontSize:11 }}>Aggiorna</span>
        </button>
      </div>
      {[
        { label:"PUN · Luce", icon:<Zap size={14} color={C.amber}/>, color:C.amber, dim:C.amberDim, mid:C.amberMid,
          value: pun ? pun.valore_medio : "—", unit:"€/kWh", bg:`linear-gradient(135deg,#1a0f00,${C.surface})`,
          mese: pun ? meseFmt(pun.mese_anno) : "" },
        { label:"PSV · Gas", icon:<Flame size={14} color={C.sky}/>, color:C.sky, dim:C.skyDim, mid:C.skyMid,
          value: psv ? psv.valore_medio : "—", unit:"€/Smc", bg:`linear-gradient(135deg,#001824,${C.surface})`,
          mese: psv ? meseFmt(psv.mese_anno) : "" },
      ].map((m,i) => (
        <div key={i} style={{ background:m.bg, border:`1px solid ${m.mid}`, borderRadius:20, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <div style={{ background:m.dim, borderRadius:8, padding:6 }}>{m.icon}</div>
            <span style={{ color:m.color, fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" }}>{m.label}</span>
            {m.mese && <span style={{ background:m.dim, color:m.color, fontSize:10, fontWeight:700, borderRadius:20, padding:"2px 8px" }}>{m.mese}</span>}
          </div>
          <p style={{ color:C.text, fontSize:34, fontWeight:800, margin:"0 0 4px", fontFamily:"'Sora',sans-serif" }}>
            {typeof m.value === "number" ? m.value.toFixed(4) : m.value}{" "}
            <span style={{ fontSize:14, color:C.textMid }}>{m.unit}</span>
          </p>
        </div>
      ))}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.textMid, fontSize:12, fontWeight:600, margin:"0 0 2px" }}>Fonte dati</p>
          <p style={{ color:C.textDim, fontSize:11, margin:0 }}>GME · Indici mensili</p>
        </div>
        <ArrowUpRight size={16} color={C.textDim} />
      </div>
    </div>
  );
}

function SettingsScreen({ user, dati, onSignOut }) {
  const { forniture = [] } = dati ?? {};
  const nomeUtente = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Utente";
  const email = user?.email ?? "";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:8 }}>
      <div>
        <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Profilo</p>
        <h2 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>Impostazioni</h2>
      </div>
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

      {forniture.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Le tue forniture</p>
          {forniture.map((f, i) => {
            const isLuce = f.tipo_utenza === "LUCE";
            const color = isLuce ? C.amber : C.sky;
            const dim   = isLuce ? C.amberDim : C.skyDim;
            const icon  = isLuce ? <Zap size={14} color={color}/> : <Flame size={14} color={color}/>;
            return (
              <div key={f.id} style={{ background:C.surface2, borderRadius:14, padding:14, border:`1px solid ${C.border2}`, marginBottom:i<forniture.length-1?10:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <div style={{ background:dim, borderRadius:8, padding:7 }}>{icon}</div>
                  <span style={{ color:color, fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>{f.tipo_utenza}</span>
                </div>
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

      <button onClick={onSignOut} style={{ background:C.surface, border:`1px solid #ef444440`, borderRadius:16, padding:16, cursor:"pointer", color:"#ef4444", fontSize:14, fontWeight:600, textAlign:"center" }}>
        Esci dall'account
      </button>
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

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
          {tab==="settings" && <SettingsScreen user={user} dati={dati} onSignOut={onSignOut} />}
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
