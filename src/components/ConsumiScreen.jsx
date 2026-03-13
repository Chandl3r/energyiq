import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { computeAndSaveAlerts } from "../AppShell";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import {
  Upload, X, CheckCircle, AlertCircle, Zap, Flame,
  ChevronLeft, ChevronRight, File,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:"#080808", surface:"#111111", border:"#1f1f1f", border2:"#2a2a2a",
  text:"#f5f5f5", textMid:"#9ca3af", textDim:"#4b5563",
  amber:"#f59e0b", amberDim:"#1c1503", amberMid:"#78350f",
  sky:"#38bdf8",  skyDim:"#001f2e",   skyMid:"#0c4a6e",
  green:"#22c55e", red:"#ef4444",
};
const MESI_S = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const MESI_L = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
                "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseLuceCSV(text) {
  const rows = text.trim().split("\n");
  const hdr  = rows[0].split(";").map(h => h.trim());
  const iData = hdr.findIndex(h => h === "data_lettura");
  const iAnno = hdr.findIndex(h => h === "annomese_riferimento");
  const iEa1  = hdr.findIndex(h => h === "ea1");
  const iPod  = hdr.findIndex(h => h === "pod");
  if (iData < 0 || iAnno < 0 || iEa1 < 0)
    return { error: "Colonne non trovate — file ARERA Luce non riconosciuto." };

  const byDate = new Map();
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].split(";");
    if (c.length < iEa1 + 96) continue;
    const dataTxt  = c[iData]?.trim();
    const annoMese = parseInt(c[iAnno]?.trim());
    const pod      = c[iPod]?.trim() || "";
    if (!dataTxt || !annoMese) continue;
    const p = dataTxt.split("/");
    if (p.length !== 3) continue;
    const dataISO = `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
    const ea = []; let tot = 0;
    for (let k = 0; k < 96; k++) { const v = parseFloat(c[iEa1+k])||0; ea.push(v); tot+=v; }
    byDate.set(dataISO, { pod, data_lettura:dataISO, annomese_riferimento:annoMese,
      totale_kwh:Math.round(tot*1000)/1000, valori_ea:ea });
  }
  const result = Array.from(byDate.values());
  return { rows:result, count:result.length, mesi:new Set(result.map(r=>r.annomese_riferimento)).size };
}

function parseGasCSV(text) {
  const rows = text.trim().split("\n");
  const byKey = new Map();
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].split(";");
    if (c.length < 7) continue;
    const pdr     = c[0]?.trim();
    const anno    = parseInt(c[1]?.trim());
    const data    = c[2]?.trim();
    const lettura = parseFloat(c[6]?.trim().replace(/^0+/,"") || "0");
    if (!pdr || !anno || !data || lettura===0) continue;
    const key = `${pdr}|${data}`;
    const ex  = byKey.get(key);
    if (!ex || lettura > ex.lettura_smc)
      byKey.set(key, { pdr, annomese_riferimento:anno, data_lettura:data, lettura_smc:lettura });
  }
  const result = Array.from(byKey.values()).sort((a,b)=>a.data_lettura.localeCompare(b.data_lettura));
  return { rows:result, count:result.length };
}

// ─── Aggregazioni ─────────────────────────────────────────────────────────────

function fmtMese(annomese) {
  const s = String(annomese);
  return `${MESI_S[parseInt(s.slice(4))-1]} ${s.slice(2,4)}`;
}

function aggLuceMensile(misure) {
  const map = new Map();
  for (const m of misure) map.set(m.annomese_riferimento, (map.get(m.annomese_riferimento)||0)+m.totale_kwh);
  return Array.from(map.entries()).sort(([a],[b])=>a-b)
    .map(([k,v]) => ({ mese:fmtMese(k), kwh:Math.round(v) }));
}

function aggGasMensile(letture) {
  const byM = new Map();
  for (const l of letture)
    if (!byM.has(l.annomese_riferimento) || l.lettura_smc > byM.get(l.annomese_riferimento).lettura_smc)
      byM.set(l.annomese_riferimento, l);
  const sorted = Array.from(byM.values()).sort((a,b)=>a.annomese_riferimento-b.annomese_riferimento);
  return sorted.slice(1).map((r,i) => {
    const diff = r.lettura_smc - sorted[i].lettura_smc;
    return diff >= 0 && diff < 400 ? { mese:fmtMese(r.annomese_riferimento), smc:Math.round(diff*10)/10 } : null;
  }).filter(Boolean);
}

// Curva 24h per giorno selezionato + media storica (in Watt)
function getCurva(misure, selectedDate) {
  const byDate = {};
  for (const m of misure) byDate[m.data_lettura] = m.valori_ea;
  const sums = new Array(96).fill(0), counts = new Array(96).fill(0);
  for (const m of misure) {
    if (!Array.isArray(m.valori_ea)) continue;
    for (let k=0; k<96; k++) { const v=parseFloat(m.valori_ea[k])||0; if(v>0){sums[k]+=v;counts[k]++;} }
  }
  const ea = byDate[selectedDate];
  return Array.from({length:24},(_,h) => {
    let giorno=null, media=0;
    for (let s=0; s<4; s++) {
      const k=h*4+s;
      if (ea) giorno=(giorno||0)+(parseFloat(ea[k])||0);
      if (counts[k]>0) media+=sums[k]/counts[k];
    }
    return { ora:`${h.toString().padStart(2,"0")}:00`,
      giorno: giorno!==null ? Math.round(giorno*1000) : null,
      media:  Math.round(media*1000) };
  });
}

// ─── Icone file ───────────────────────────────────────────────────────────────

function LuceFileIcon({ size=52, color=C.amber }) {
  return (
    <div style={{ position:"relative", width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <File size={size} color={color} strokeWidth={1.5} />
      <div style={{ position:"absolute", top:"52%", left:"50%", transform:"translate(-50%,-50%)" }}>
        <Zap size={Math.round(size*.36)} color={color} fill={color} />
      </div>
    </div>
  );
}
function GasFileIcon({ size=52, color=C.sky }) {
  return (
    <div style={{ position:"relative", width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <File size={size} color={color} strokeWidth={1.5} />
      <div style={{ position:"absolute", top:"52%", left:"50%", transform:"translate(-50%,-50%)" }}>
        <Flame size={Math.round(size*.36)} color={color} fill={color} />
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

// dateStr → "12 Marzo 2025" | meseLabel → già formattato (es. "Nov 25")
function KpiCard({ label, emoji, value, unit, dateStr, meseLabel, color }) {
  let dl = meseLabel || "—";
  if (!meseLabel && dateStr) {
    const d = new Date(dateStr);
    dl = `${d.getDate()} ${MESI_L[d.getMonth()]} ${d.getFullYear()}`;
  }
  return (
    <div style={{ background:C.surface, border:`1px solid ${color}30`, borderRadius:18, padding:"14px 16px", flex:1 }}>
      <p style={{ color, fontSize:9, fontWeight:700, letterSpacing:1.3, textTransform:"uppercase", margin:"0 0 10px" }}>{emoji} {label}</p>
      <p style={{ color:C.text, fontSize:26, fontWeight:800, fontFamily:"'Sora',sans-serif", margin:"0 0 2px", lineHeight:1 }}>
        {value}<span style={{ fontSize:11, color:C.textMid, fontWeight:400, marginLeft:3 }}>{unit}</span>
      </p>
      <p style={{ color:C.textDim, fontSize:9, marginTop:5 }}>{dl}</p>
    </div>
  );
}

// ─── Curva di Carico ──────────────────────────────────────────────────────────

function CurvaGiornaliera({ misure }) {
  const dates = useMemo(() => [...new Set(misure.map(m=>m.data_lettura))].sort(), [misure]);
  const [idx, setIdx] = useState(dates.length-1);
  const selDate = dates[Math.min(idx, dates.length-1)] || null;
  const curva   = useMemo(() => selDate ? getCurva(misure, selDate) : [], [misure, selDate]);
  const totKwh  = selDate ? (misure.find(m=>m.data_lettura===selDate)?.totale_kwh ?? 0) : 0;

  const d = selDate ? new Date(selDate) : null;
  const DOW = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];
  const dl = d ? `${DOW[d.getDay()]} ${d.getDate()} ${MESI_S[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` : "";

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const g = payload.find(p=>p.dataKey==="giorno");
    const m = payload.find(p=>p.dataKey==="media");
    return (
      <div style={{ background:C.surface, border:`1px solid ${C.amberMid}`, borderRadius:10, padding:"8px 12px" }}>
        <p style={{ color:C.textDim, fontSize:9, marginBottom:4 }}>{label}</p>
        {g?.value!=null && <p style={{ color:C.amber, fontSize:13, fontWeight:800, margin:"0 0 2px", fontFamily:"'Sora',sans-serif" }}>{g.value} W</p>}
        <p style={{ color:C.textDim, fontSize:10 }}>Media {m?.value} W</p>
      </div>
    );
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.amberMid}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 0" }}>
        <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", margin:"0 0 10px" }}>
          ⚡ Curva di Carico
        </p>
        {/* Nav giorno */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0}
            style={{ background:"none", border:"none", cursor:idx>0?"pointer":"default", padding:"4px 0", lineHeight:0 }}>
            <ChevronLeft size={20} color={idx>0?C.textMid:C.border2} />
          </button>
          <div style={{ textAlign:"center" }}>
            <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:0 }}>{dl}</p>
            <p style={{ color:C.amber, fontSize:12, fontWeight:600, margin:"2px 0 0", fontFamily:"'Sora',sans-serif" }}>
              {totKwh.toFixed(2)} <span style={{ fontSize:9, color:C.textDim, fontWeight:400 }}>kWh totali</span>
            </p>
          </div>
          <button onClick={()=>setIdx(i=>Math.min(dates.length-1,i+1))} disabled={idx===dates.length-1}
            style={{ background:"none", border:"none", cursor:idx<dates.length-1?"pointer":"default", padding:"4px 0", lineHeight:0 }}>
            <ChevronRight size={20} color={idx<dates.length-1?C.textMid:C.border2} />
          </button>
        </div>
        {/* Legend */}
        <div style={{ display:"flex", gap:16, marginBottom:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:14, height:2, background:C.amber, borderRadius:1 }} />
            <span style={{ color:C.textDim, fontSize:9 }}>Questo giorno</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            {[0,1,2].map(i=><div key={i} style={{ width:4, height:2, background:C.textDim, borderRadius:1 }}/>)}
            <span style={{ color:C.textDim, fontSize:9, marginLeft:1 }}>Media storica</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={curva} margin={{ top:4, right:16, left:16, bottom:4 }}>
          <XAxis dataKey="ora" axisLine={false} tickLine={false} tick={{ fill:C.textDim, fontSize:8 }} interval={5} />
          <YAxis hide />
          <Tooltip content={<Tip />} />
          <Line type="natural" dataKey="media" stroke={C.textDim} strokeWidth={1.5}
            strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          <Line type="natural" dataKey="giorno" stroke={C.amber} strokeWidth={2.5}
            dot={false} activeDot={{ r:4, fill:C.amber, stroke:"white", strokeWidth:2 }}
            connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function HeatmapLuce({ misure }) {
  const scrollRef = useRef();

  const byDate = useMemo(() => {
    const m = {};
    for (const r of misure) m[r.data_lettura] = r.totale_kwh;
    return m;
  }, [misure]);

  const dates = Object.keys(byDate).sort();
  if (!dates.length) return null;

  const maxKwh = Math.max(...Object.values(byDate), 0.1);
  const minKwh = Math.min(...Object.values(byDate));
  const maxDay = dates.reduce((best, d) => byDate[d] > (byDate[best]||0) ? d : best, dates[0]);
  const minDay = dates.reduce((best, d) => byDate[d] < (byDate[best]??Infinity) ? d : best, dates[0]);

  // Lunedì precedente la prima data
  const start = new Date(dates[0]);
  const firstMon = new Date(start);
  firstMon.setDate(start.getDate() - ((start.getDay()+6)%7));
  const end = new Date(dates[dates.length-1]);

  const CELL=11, GAP=3, STEP=CELL+GAP, LEFT=16;

  const weeks = [];
  const cur = new Date(firstMon);
  while (cur <= end) {
    const week = [];
    for (let d=0; d<7; d++) {
      const iso = cur.toISOString().slice(0,10);
      week.push({ date:iso, kwh: byDate[iso]??null });
      cur.setDate(cur.getDate()+1);
    }
    weeks.push(week);
  }

  // Label mesi
  const monthLabels = [];
  weeks.forEach((week,wi) => {
    const d = new Date(week[0].date);
    if (d.getDate() <= 7 || wi===0) {
      const prev = monthLabels[monthLabels.length-1];
      const prevMese = prev ? new Date(weeks[prev.wi][0].date).getMonth() : -1;
      if (prevMese !== d.getMonth()) monthLabels.push({ wi, label:MESI_S[d.getMonth()] });
    }
  });

  const SVG_W = LEFT + weeks.length*STEP;
  const SVG_H = 18 + 7*STEP;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [weeks.length]);

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.amberMid}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 8px" }}>
        <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", margin:"0 0 2px" }}>
          ⚡ Heatmap Consumi
        </p>
        <p style={{ color:C.textDim, fontSize:10 }}>{dates.length} giorni · intensità = kWh consumati</p>
      </div>
      <div ref={scrollRef} style={{ overflowX:"auto", padding:"0 18px 10px", WebkitOverflowScrolling:"touch" }}>
        <svg width={SVG_W} height={SVG_H} style={{ display:"block" }}>
          {/* Mesi */}
          {monthLabels.map((ml,i) => (
            <text key={i} x={LEFT+ml.wi*STEP} y={10} fill={C.textDim} fontSize={8} fontFamily="DM Sans,sans-serif">{ml.label}</text>
          ))}
          {/* Giorni della settimana */}
          {["L","M","M","G","V","S","D"].map((l,di) => (
            <text key={di} x={LEFT-3} y={18+di*STEP+CELL-1}
              fill={C.textDim} fontSize={7} textAnchor="end" fontFamily="DM Sans,sans-serif">{l}</text>
          ))}
          {/* Celle */}
          {weeks.map((week,wi) => week.map((day,di) => {
            const has = day.kwh !== null;
            let fill = C.border;
            if (has) {
              const pct = (day.kwh - minKwh) / (maxKwh - minKwh + 0.001);
              fill = `rgba(245,158,11,${(0.12 + pct*0.88).toFixed(2)})`;
            }
            const isMax = day.date === maxDay;
            const isMin = day.date === minDay;
            return (
              <rect key={`${wi}-${di}`}
                x={LEFT+wi*STEP} y={18+di*STEP}
                width={CELL} height={CELL} rx={2}
                fill={fill}
                stroke={isMax ? C.red : isMin ? C.green : "none"}
                strokeWidth={isMax||isMin ? 1.5 : 0}
              />
            );
          }))}
        </svg>
      </div>
      {/* Scala colori + legenda picchi */}
      <div style={{ padding:"4px 18px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ color:C.textDim, fontSize:9 }}>Basso</span>
          <div style={{ display:"flex", gap:2 }}>
            {[0.12,0.33,0.54,0.75,0.96].map((a,i)=>(
              <div key={i} style={{ width:CELL, height:CELL, borderRadius:2, background:`rgba(245,158,11,${a})` }} />
            ))}
          </div>
          <span style={{ color:C.textDim, fontSize:9 }}>Alto</span>
        </div>
        <div style={{ display:"flex", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:CELL, height:CELL, borderRadius:2, border:`1.5px solid ${C.red}`, background:"transparent" }} />
            <span style={{ color:C.textDim, fontSize:9 }}>Record ({maxDay?.slice(5).split("-").reverse().join("/")})</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:CELL, height:CELL, borderRadius:2, border:`1.5px solid ${C.green}`, background:"transparent" }} />
            <span style={{ color:C.textDim, fontSize:9 }}>Migliore ({minDay?.slice(5).split("-").reverse().join("/")})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profilo Giorno-Tipo ──────────────────────────────────────────────────────
// Tre curve sovrapposte: media Feriali (Lun-Ven), Sabato, Domenica

function ProfiloGiornoTipo({ misure }) {
  const data = useMemo(() => {
    if (!misure.length) return [];
    // Raggruppa slot per tipo giorno
    const groups = { feriale:[...Array(96)].map(()=>({s:0,c:0})), sab:[...Array(96)].map(()=>({s:0,c:0})), dom:[...Array(96)].map(()=>({s:0,c:0})) };
    for (const m of misure) {
      if (!Array.isArray(m.valori_ea)) continue;
      const dow = new Date(m.data_lettura).getDay(); // 0=dom,6=sab
      const grp = dow === 0 ? "dom" : dow === 6 ? "sab" : "feriale";
      for (let k=0; k<96; k++) {
        const v = parseFloat(m.valori_ea[k])||0;
        if (v > 0) { groups[grp][k].s += v; groups[grp][k].c++; }
      }
    }
    // Aggrega in 24h in Watt
    return Array.from({length:24}, (_,h) => {
      const toW = (grp) => {
        let sum = 0;
        for (let s=0;s<4;s++) { const k=h*4+s; if(groups[grp][k].c>0) sum+=groups[grp][k].s/groups[grp][k].c; }
        return Math.round(sum*1000);
      };
      return { ora:`${h.toString().padStart(2,"0")}:00`, feriale:toW("feriale"), sab:toW("sab"), dom:toW("dom") };
    });
  }, [misure]);

  if (!data.length) return null;

  const Tip = ({ active, payload, label }) => {
    if (!active||!payload?.length) return null;
    return (
      <div style={{ background:C.surface, border:`1px solid ${C.amberMid}`, borderRadius:10, padding:"8px 12px" }}>
        <p style={{ color:C.textDim, fontSize:9, marginBottom:6 }}>{label}</p>
        {payload.map(p => p.value > 0 && (
          <p key={p.dataKey} style={{ color:p.color, fontSize:11, fontWeight:700, margin:"0 0 2px", fontFamily:"'Sora',sans-serif" }}>
            {p.value} W {p.name}
          </p>
        ))}
      </div>
    );
  };

  const F1_START=9, F1_END=19, F2A_END=8, F2B_START=20, F3_SAT=7, F3_SUN=23;

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.amberMid}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 8px" }}>
        <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", margin:"0 0 2px" }}>
          ⚡ Profilo Giorno-Tipo
        </p>
        <p style={{ color:C.textDim, fontSize:10, margin:"0 0 10px" }}>Media oraria per tipo di giorno</p>
        {/* Legenda */}
        <div style={{ display:"flex", gap:14 }}>
          {[
            { key:"feriale", label:"Feriale", color:C.amber },
            { key:"sab",     label:"Sabato",  color:"#a78bfa" },
            { key:"dom",     label:"Domenica",color:"#fb923c" },
          ].map(({key,label,color}) => (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:14, height:2, background:color, borderRadius:1 }} />
              <span style={{ color:C.textDim, fontSize:9 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top:4, right:16, left:16, bottom:4 }}>
          <XAxis dataKey="ora" axisLine={false} tickLine={false} tick={{ fill:C.textDim, fontSize:8 }} interval={5} />
          <YAxis hide />
          <Tooltip content={<Tip />} />
          <Line type="natural" dataKey="feriale" name="Feriale" stroke={C.amber}    strokeWidth={2}   dot={false} isAnimationActive={false} />
          <Line type="natural" dataKey="sab"     name="Sabato"  stroke="#a78bfa"    strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="5 3" />
          <Line type="natural" dataKey="dom"     name="Dom."    stroke="#fb923c"    strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="2 3" />
        </LineChart>
      </ResponsiveContainer>
      {/* Fasce orarie F1/F2/F3 — mini legenda */}
      <div style={{ display:"flex", gap:10, padding:"4px 18px 14px" }}>
        {[
          { label:"F1 08-19 lun-ven", color:"#ef4444" },
          { label:"F2 ore di punta rimanenti", color:"#f59e0b" },
          { label:"F3 notte + weekend", color:"#22c55e" },
        ].map(({label,color}) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:color, flexShrink:0 }} />
            <span style={{ color:C.textDim, fontSize:8 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bar Card ─────────────────────────────────────────────────────────────────

function BarCard({ title, subtitle, color, borderColor, data, dataKey, unit }) {
  const max = Math.max(...data.map(d=>d[dataKey]),1);
  const Tip = ({ active, payload, label }) => {
    if (!active||!payload?.length) return null;
    return (
      <div style={{ background:C.surface, border:`1px solid ${color}40`, borderRadius:10, padding:"8px 12px" }}>
        <p style={{ color:C.textDim, fontSize:9, marginBottom:3 }}>{label}</p>
        <p style={{ color, fontSize:13, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>{payload[0].value} {unit}</p>
      </div>
    );
  };
  return (
    <div style={{ background:C.surface, border:`1px solid ${borderColor}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 8px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
          <p style={{ color, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", margin:0 }}>{title}</p>
          <span style={{ background:`${color}18`, border:`1px solid ${color}30`, color, fontSize:8, fontWeight:700, borderRadius:6, padding:"2px 7px", letterSpacing:0.5, whiteSpace:"nowrap" }}>
            📡 contatore reale
          </span>
        </div>
        <p style={{ color:C.textDim, fontSize:10, margin:0 }}>{subtitle} · più precisi delle bollette</p>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} margin={{ top:8, right:16, left:16, bottom:4 }} barCategoryGap="30%">
          <XAxis dataKey="mese" axisLine={false} tickLine={false} tick={{ fill:C.textDim, fontSize:9 }} interval={0} />
          <YAxis hide domain={[0,max*1.15]} />
          <Tooltip content={<Tip />} cursor={{ fill:`${color}10` }} />
          <Bar dataKey={dataKey} radius={[6,6,2,2]} isAnimationActive={false}>
            {data.map((entry,i) => {
              const pct = entry[dataKey]/max;
              const isMax = entry[dataKey]===max;
              return <Cell key={i} fill={isMax ? color : `${color}${Math.round(pct*160+30).toString(16).padStart(2,"0")}`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Card picker per il modal ─────────────────────────────────────────────────

function CsvCard({ label, sub, FileIconComp, color, dim, border, file, preview, error, inputRef, onChange }) {
  return (
    <div onClick={() => inputRef.current?.click()}
      style={{ flex:1, background: file ? dim : "#111", border:`1.5px solid ${file ? color : C.border2}`,
        borderRadius:20, padding:"22px 12px 18px", cursor:"pointer",
        display:"flex", flexDirection:"column", alignItems:"center", gap:10, minHeight:168 }}>
      <div style={{ background:dim, borderRadius:16, padding:14 }}>
        <FileIconComp size={42} />
      </div>
      <div style={{ textAlign:"center" }}>
        <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 4px" }}>{label}</p>
        <p style={{ color: error ? C.red : file ? color : C.textDim, fontSize:10, lineHeight:1.4 }}>
          {error || preview || sub}
        </p>
      </div>
      <input ref={inputRef} type="file" accept=".csv" onChange={onChange} style={{ display:"none" }} />
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ user, onClose, onDone }) {
  const luceRef=useRef(), gasRef=useRef();
  const [lP, setLP]=useState(null), [gP, setGP]=useState(null); // parsed rows
  const [lPrev,setLPrev]=useState(null), [gPrev,setGPrev]=useState(null);
  const [lErr, setLErr]=useState(null),  [gErr, setGErr]=useState(null);
  const [lFile,setLFile]=useState(null), [gFile,setGFile]=useState(null);
  const [saving,setSaving]=useState(false), [done,setDone]=useState(false), [saveErr,setSaveErr]=useState(null);

  function rdCSV(file, parser, setRows, setPreview, setError) {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => {
      const res = parser(e.target.result);
      if (res.error) { setError(res.error); setRows(null); return; }
      setError(null); setRows(res.rows); setPreview(res);
    };
    r.readAsText(file);
  }

  function handleLuce(f) { setLFile(f); setLP(null); setLPrev(null); setLErr(null); rdCSV(f, parseLuceCSV, setLP, setLPrev, setLErr); }
  function handleGas(f)  { setGFile(f); setGP(null); setGPrev(null); setGErr(null); rdCSV(f, parseGasCSV, setGP, setGPrev, setGErr); }

  async function save() {
    setSaving(true); setSaveErr(null);
    try {
      if (lP?.length) {
        const rows = lP.map(r=>({...r, utente_id:user.id}));
        for (let i=0;i<rows.length;i+=20) {
          const {error} = await supabase.from("misure_quartorarie").upsert(rows.slice(i,i+20),{onConflict:"utente_id,pod,data_lettura"});
          if (error) throw new Error(error.message);
        }
      }
      if (gP?.length) {
        const {error} = await supabase.from("letture_gas_arera").upsert(gP.map(r=>({...r,utente_id:user.id})),{onConflict:"utente_id,pdr,data_lettura"});
        if (error) throw new Error(error.message);
      }
      setDone(true);
      // Ricarica dati ARERA per calcolo alert
      const [{data:allMisure}] = await Promise.all([
        supabase.from("misure_quartorarie").select("data_lettura,totale_kwh").eq("utente_id",user.id).order("data_lettura"),
      ]);
      const [{data:allGas}] = await Promise.all([
        supabase.from("letture_gas_arera").select("annomese_riferimento,data_lettura,lettura_smc").eq("utente_id",user.id).order("data_lettura"),
      ]);
      // gasBar per alert gas
      const gb = aggGasMensile(allGas || []);
      computeAndSaveAlerts(user.id, allMisure || [], gb);
      setTimeout(onDone,1000);
    } catch(e) { setSaveErr(e.message); }
    finally { setSaving(false); }
  }

  const canSave = !saving && !done && (lP?.length||gP?.length);

  const lPreviewStr = lPrev ? `${lPrev.count} giorni · ${lPrev.mesi} mesi` : null;
  const gPreviewStr = gPrev ? `${gPrev.count} letture trovate` : null;

  return (
    <div style={{ position:"fixed", inset:0, background:"#000c", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget && !saving) onClose(); }}>
      <div style={{ background:C.bg, border:`1px solid ${C.border2}`, borderRadius:"24px 24px 0 0",
        padding:"24px 20px 44px", width:"100%", maxWidth:430 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <p style={{ color:C.textDim, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", margin:"0 0 3px" }}>ARERA</p>
            <h2 style={{ color:C.text, fontSize:22, fontWeight:800, fontFamily:"'Sora',sans-serif", margin:0 }}>Importa Misure</h2>
          </div>
          {!saving && <button onClick={onClose} style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:10, padding:8, cursor:"pointer", lineHeight:0 }}><X size={16} color={C.textMid} /></button>}
        </div>

        <div style={{ display:"flex", gap:12, marginBottom:12 }}>
          <CsvCard label="Carica CSV Luce" sub="(misure quartorarie)"
            FileIconComp={({size})=><LuceFileIcon size={size} />}
            color={C.amber} dim={C.amberDim} border={C.amberMid}
            file={lFile} preview={lPreviewStr} error={lErr}
            inputRef={luceRef} onChange={e=>handleLuce(e.target.files[0])} />
          <CsvCard label="Carica CSV Gas" sub="(letture cumulative)"
            FileIconComp={({size})=><GasFileIcon size={size} />}
            color={C.sky} dim={C.skyDim} border={C.skyMid}
            file={gFile} preview={gPreviewStr} error={gErr}
            inputRef={gasRef} onChange={e=>handleGas(e.target.files[0])} />
        </div>

        {/* Istruzioni accordion */}
        <AreraSteps />
        <div style={{ height:12 }} />

        {saveErr && (
          <div style={{ display:"flex", gap:8, alignItems:"center", background:"#1a0505", border:"1px solid #7f1d1d", borderRadius:12, padding:"10px 14px", marginBottom:12 }}>
            <AlertCircle size={14} color={C.red} />
            <span style={{ color:C.red, fontSize:12 }}>{saveErr}</span>
          </div>
        )}

        <button onClick={save} disabled={!canSave}
          style={{ width:"100%", padding:16, borderRadius:16, cursor:canSave?"pointer":"default",
            background: done?"#052e1a": canSave?C.amber: C.surface,
            border:`1px solid ${done?C.green: canSave?C.amber: C.border2}`,
            display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {done
            ? <><CheckCircle size={16} color={C.green}/><span style={{color:C.green,fontSize:15,fontWeight:700}}>Salvato!</span></>
            : saving
              ? <span style={{color:C.textMid,fontSize:14}}>Salvataggio…</span>
              : <span style={{color:canSave?"black":C.textDim,fontSize:15,fontWeight:700}}>
                  {canSave ? "Salva su Supabase" : "Seleziona almeno un file"}
                </span>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Gas: confronto ultimo mese vs media ultimi 3 ────────────────────────────

function GasConfronto({ gasBar }) {
  if (gasBar.length < 2) return null;

  const ultimo   = gasBar[gasBar.length - 1];
  const prev3    = gasBar.slice(-4, -1); // fino a 3 mesi prima dell'ultimo
  if (prev3.length === 0) return null;

  const media3   = prev3.reduce((s,r) => s + r.smc, 0) / prev3.length;
  const delta    = ultimo.smc - media3;
  const deltaPct = Math.round((delta / media3) * 100);
  const positive = delta > 0; // più consumo = negativo per l'utente
  const neutral  = Math.abs(deltaPct) < 3;

  const Icon  = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  const color = neutral ? C.textMid : positive ? C.red : C.green;
  const label = neutral
    ? "In linea con la media"
    : positive
      ? `${Math.abs(deltaPct)}% più del solito`
      : `${Math.abs(deltaPct)}% meno del solito`;
  const sublabel = `vs media ${prev3.map(r=>r.mese).join(", ")}`;

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.skyMid}`, borderRadius:20, padding:"18px 20px" }}>
      <p style={{ color:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", margin:"0 0 14px" }}>
        🔥 Gas · Confronto mensile
      </p>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        {/* Numero grande */}
        <div>
          <p style={{ color:C.text, fontSize:30, fontWeight:800, fontFamily:"'Sora',sans-serif", margin:0, lineHeight:1 }}>
            {ultimo.smc}<span style={{ fontSize:12, color:C.textMid, fontWeight:400, marginLeft:4 }}>Smc</span>
          </p>
          <p style={{ color:C.textDim, fontSize:10, margin:"4px 0 0" }}>{ultimo.mese} (ultimo mese)</p>
        </div>
        {/* Freccia e percentuale */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:`${color}15`, border:`1px solid ${color}30`, borderRadius:12, padding:"6px 12px" }}>
            <Icon size={16} color={color} strokeWidth={2.5} />
            <span style={{ color, fontSize:15, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
              {neutral ? "—" : `${positive ? "+" : ""}${deltaPct}%`}
            </span>
          </div>
          <p style={{ color, fontSize:11, fontWeight:600, margin:0 }}>{label}</p>
          <p style={{ color:C.textDim, fontSize:9, margin:0, textAlign:"right" }}>{sublabel}</p>
        </div>
      </div>
      {/* Mini bar confronto */}
      <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
        <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:32 }}>
          {[...prev3, ultimo].map((r, i) => {
            const maxS = Math.max(...[...prev3, ultimo].map(x=>x.smc), 1);
            const pct  = r.smc / maxS;
            const isLast = i === prev3.length;
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ width:"100%", borderRadius:"4px 4px 2px 2px",
                  height:`${Math.round(pct*28)+4}px`,
                  background: isLast ? C.sky : `${C.sky}40`,
                  border: isLast ? `1px solid ${C.sky}` : "none",
                }} />
                <span style={{ color: isLast ? C.sky : C.textDim, fontSize:8, fontWeight: isLast ? 700:400 }}>{r.mese}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Istruzioni ARERA ─────────────────────────────────────────────────────────

function AreraSteps() {
  const steps = [
    { n:"1", text:"Vai su consumienergia.it e accedi con SPID o CIE" },
    { n:"2", text:'Seleziona l\'utenza dal menu a tendina in alto' },
    { n:"3", text:'Clicca su "Scarica Letture" e salva il CSV' },
    { n:"4", text:"Ripeti per luce e gas (sono due file separati)" },
  ];
  return (
    <div style={{ background:"#0e0e0e", border:`1px solid ${C.border2}`, borderRadius:16, padding:"14px 16px", marginTop:14 }}>
      <p style={{ color:C.textDim, fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", margin:"0 0 12px" }}>
        📥 Come scaricare i CSV
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {steps.map(({ n, text }) => (
          <div key={n} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:C.amberDim, border:`1px solid ${C.amberMid}`,
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
              <span style={{ color:C.amber, fontSize:9, fontWeight:800 }}>{n}</span>
            </div>
            <p style={{ color:C.textMid, fontSize:12, lineHeight:1.5, margin:0 }}>{text}</p>
          </div>
        ))}
      </div>
      <p style={{ color:C.textDim, fontSize:10, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        🔗 <span style={{ color:C.sky }}>consumienergia.it</span> → area riservata
      </p>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onImport }) {
  return (
    <div style={{ paddingTop:8 }}>
      <p style={{ color:C.textDim, fontSize:12, textAlign:"center", lineHeight:1.7, margin:"0 auto 22px", maxWidth:300 }}>
        Importa i CSV dal portale ARERA per vedere curva di carico, heatmap e statistiche giornaliere che nessun fornitore ti mostra.
      </p>
      {/* Card cliccabili */}
      <div style={{ display:"flex", gap:12, marginBottom:4 }}>
        {[
          { label:"Carica CSV Luce", sub:"(misure quartorarie)", Ic:({size})=><LuceFileIcon size={size}/>, color:C.amber, dim:C.amberDim, bdr:C.amberMid },
          { label:"Carica CSV Gas",  sub:"(letture cumulative)", Ic:({size})=><GasFileIcon size={size}/>,  color:C.sky,   dim:C.skyDim,   bdr:C.skyMid  },
        ].map(({label,sub,Ic,color,dim,bdr}) => (
          <div key={label} onClick={onImport}
            style={{ flex:1, background:"#111", border:`1.5px solid ${bdr}`, borderRadius:20,
              padding:"22px 12px 18px", cursor:"pointer", display:"flex", flexDirection:"column",
              alignItems:"center", gap:10, minHeight:168 }}>
            <div style={{ background:dim, borderRadius:16, padding:14 }}><Ic size={42} /></div>
            <div style={{ textAlign:"center" }}>
              <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 3px" }}>{label}</p>
              <p style={{ color:C.textDim, fontSize:10 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Istruzioni */}
      <AreraSteps />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ConsumiScreen({ user }) {
  const [misure, setMisure] = useState([]);
  const [letture,setLetture]= useState([]);
  const [loading,setLoading]= useState(true);
  const [showImport,setShowImport] = useState(false);

  useEffect(() => { load(); }, [user?.id]);

  async function load() {
    setLoading(true);
    const [{data:ml},{data:lg}] = await Promise.all([
      supabase.from("misure_quartorarie").select("data_lettura,annomese_riferimento,totale_kwh,valori_ea").eq("utente_id",user.id).order("data_lettura"),
      supabase.from("letture_gas_arera").select("annomese_riferimento,data_lettura,lettura_smc").eq("utente_id",user.id).order("data_lettura"),
    ]);
    setMisure(ml||[]); setLetture(lg||[]); setLoading(false);
  }

  const hasLuce = misure.length > 0;
  const hasGas  = letture.length > 0;
  const hasData = hasLuce || hasGas;

  const maxDay = useMemo(() => hasLuce ? misure.reduce((b,r)=>r.totale_kwh>(b?.totale_kwh||0)?r:b,null) : null, [misure]);
  const minDay = useMemo(() => hasLuce ? misure.filter(r=>r.totale_kwh>0).reduce((b,r)=>r.totale_kwh<(b?.totale_kwh??Infinity)?r:b,null) : null, [misure]);
  const luceBar = useMemo(() => aggLuceMensile(misure), [misure]);
  const gasBar  = useMemo(() => aggGasMensile(letture), [letture]);

  // Gas KPI — mese con maggior e minor consumo
  const maxMeseGas = useMemo(() => gasBar.length ? gasBar.reduce((b,r)=>r.smc>b.smc?r:b) : null, [gasBar]);
  const minMeseGas = useMemo(() => gasBar.length ? gasBar.reduce((b,r)=>r.smc<b.smc?r:b) : null, [gasBar]);

  return (
    <div style={{ paddingTop:8 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <p style={{ color:C.textDim, fontSize:11, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", margin:"0 0 4px" }}>ARERA</p>
          <h1 style={{ color:C.text, fontSize:28, fontWeight:800, fontFamily:"'Sora',sans-serif", margin:0 }}>Consumi</h1>
        </div>
        {hasData && (
          <button onClick={()=>setShowImport(true)}
            style={{ background:C.amberDim, border:`1px solid ${C.amberMid}`, borderRadius:12,
              padding:"8px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
            <Upload size={14} color={C.amber}/>
            <span style={{ color:C.amber, fontSize:12, fontWeight:700 }}>Aggiorna</span>
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color:C.textDim, textAlign:"center", padding:48, fontSize:13 }}>Caricamento…</p>
      ) : !hasData ? (
        <EmptyState onImport={()=>setShowImport(true)} />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* KPI giorno record / migliore */}
          {hasLuce && maxDay && minDay && (
            <div style={{ display:"flex", gap:10 }}>
              <KpiCard label="Picco consumo" emoji="🔴"
                value={maxDay.totale_kwh.toFixed(1)} unit="kWh"
                dateStr={maxDay.data_lettura} color={C.red} />
              <KpiCard label="Giorno migliore" emoji="🟢"
                value={minDay.totale_kwh.toFixed(1)} unit="kWh"
                dateStr={minDay.data_lettura} color={C.green} />
            </div>
          )}

          {/* Curva di carico con nav */}
          {hasLuce && <CurvaGiornaliera misure={misure} />}

          {/* Profilo giorno-tipo Lun/Sab/Dom */}
          {hasLuce && <ProfiloGiornoTipo misure={misure} />}

          {/* Heatmap */}
          {hasLuce && <HeatmapLuce misure={misure} />}

          {/* Gas: KPI + confronto mensile + bar */}
          {gasBar.length > 0 && (
            <>
              <div style={{ display:"flex", gap:10 }}>
                <KpiCard label="Mese record" emoji="🔴"
                  value={maxMeseGas.smc} unit="Smc"
                  meseLabel={maxMeseGas.mese} color={C.red} />
                <KpiCard label="Mese più sobrio" emoji="🟢"
                  value={minMeseGas.smc} unit="Smc"
                  meseLabel={minMeseGas.mese} color={C.green} />
              </div>
              <GasConfronto gasBar={gasBar} />
            </>
          )}
        </div>
      )}

      {showImport && (
        <ImportModal user={user} onClose={()=>setShowImport(false)} onDone={()=>{setShowImport(false);load();}} />
      )}
    </div>
  );
}
