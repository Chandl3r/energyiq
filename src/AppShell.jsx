import { useState, useRef } from "react";
import UploadScreen from "./components/UploadScreen";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  Zap, Flame, Home, Upload, BarChart2, Settings,
  CheckCircle, ChevronRight, Camera, FileText, Bell, RefreshCw, ArrowUpRight, TrendingUp
} from "lucide-react";

const luceData = [
  { mese:"Ott", kwh:461 },{ mese:"Nov", kwh:451 },{ mese:"Dic", kwh:552 },
  { mese:"Gen", kwh:527 },{ mese:"Feb", kwh:428 },{ mese:"Mar", kwh:429 },
  { mese:"Apr", kwh:471 },{ mese:"Mag", kwh:488 },{ mese:"Giu", kwh:500 },
  { mese:"Lug", kwh:415 },{ mese:"Ago", kwh:355 },{ mese:"Set", kwh:312 },
  { mese:"Ott", kwh:364 },{ mese:"Nov", kwh:451 },{ mese:"Dic", kwh:528 },
];
const gasData = [
  { mese:"Ott", smc:40  },{ mese:"Nov", smc:92  },{ mese:"Dic", smc:158 },
  { mese:"Gen", smc:163 },{ mese:"Feb", smc:123 },{ mese:"Mar", smc:89  },
  { mese:"Apr", smc:62  },{ mese:"Mag", smc:50  },{ mese:"Giu", smc:35  },
  { mese:"Lug", smc:35  },{ mese:"Ago", smc:23  },{ mese:"Set", smc:19  },
  { mese:"Ott", smc:33  },{ mese:"Nov", smc:69  },{ mese:"Dic", smc:113 },
  { mese:"Gen", smc:150 },
];
const MAX_GAS = Math.max(...gasData.map(d => d.smc));
const MIN_KWH = Math.min(...luceData.map(d => d.kwh)) - 30;
const MAX_KWH = Math.max(...luceData.map(d => d.kwh)) + 30;

const XAXIS_H = 20;
const LUCE_H = 148;
const LUCE_M = { top:52, right:16, left:16, bottom:6 };
const LUCE_IH = LUCE_H - LUCE_M.top - LUCE_M.bottom;
const LUCE_PH = LUCE_IH - XAXIS_H;

const GAS_H = 156;
const GAS_M = { top:52, right:8, left:8, bottom:6 };
const GAS_IH = GAS_H - GAS_M.top - GAS_M.bottom;
const GAS_PH = GAS_IH - XAXIS_H;

const C = {
  bg:"#080808", surface:"#111111", surface2:"#181818",
  border:"#1e1e1e", border2:"#252525",
  amber:"#f59e0b", amberDim:"#f59e0b20", amberMid:"#f59e0b40",
  sky:"#38bdf8",   skyDim:"#38bdf820",   skyMid:"#38bdf840",
  green:"#22c55e", greenDim:"#22c55e18",
  red:"#ef4444", text:"#ffffff", textMid:"#9ca3af", textDim:"#4b5563",
};

function RingCard({ tipo, value, unit, pct, vsYear, prezzo, color, dimColor, midColor, icon, cardBg }) {
  const SIZE=74, SW=4.5;
  const r=(SIZE-SW*2)/2, cx=SIZE/2;
  const circ=2*Math.PI*r;
  const progressDash=circ*(pct/100);
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
        <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:2, whiteSpace:"nowrap" }}>
          <span style={{ color:color, fontSize:14, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>{vsYear}</span>
          <span style={{ color:C.textMid, fontSize:9 }}>vs 2024</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:2, marginBottom:2 }}>
          <span style={{ color:C.green, fontSize:10, fontWeight:700, letterSpacing:"-0.5px", whiteSpace:"nowrap" }}>↓ Conveniente</span>
        </div>
        <p style={{ color:C.textDim, fontSize:9, margin:0, whiteSpace:"nowrap" }}>{prezzo}</p>
      </div>
    </div>
  );
}

function LuceChart() {
  const wrapRef = useRef(null);
  const [active, setActive] = useState(null);

  const getActive = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX  = clientX - rect.left;
    const innerW = rect.width - LUCE_M.left - LUCE_M.right;
    const n      = luceData.length;
    const step   = innerW / (n - 1);
    const idx    = Math.max(0, Math.min(n-1, Math.round((relX - LUCE_M.left) / step)));
    const xPx    = LUCE_M.left + idx * step;
    const yPx    = LUCE_M.top + LUCE_PH * (1 - (luceData[idx].kwh - MIN_KWH) / (MAX_KWH - MIN_KWH));
    return { idx, xPx, yPx, value: luceData[idx].kwh };
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

    // Balloon X: clamped to chart bounds
    const bX = Math.max(LUCE_M.left, Math.min(w - LUCE_M.right - bW, xPx - bW/2));

    // Arrow base: centered on balloon, clamped to balloon corners
    const aTip = Math.max(bX+bR, Math.min(bX+bW-bR, xPx));

    const arrowBaseY = topY + bH - 2;  // overlaps balloon 2px
    const arrowTipY  = yPx - 8;        // just above dot

    // THE KEY FIX: arrow tip X = xPx (exact dot position), not aTip
    // → for edge months (Ott, Dic) the arrow tilts toward the dot automatically
    // → for center months aTip ≈ xPx so arrow stays straight

    const lineTop    = yPx + 6;
    const lineBottom = LUCE_M.top + LUCE_PH - 1;

    return (
      <svg style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }} width={w} height={LUCE_H}>
        {lineTop < lineBottom && (
          <line x1={xPx} y1={lineTop} x2={xPx} y2={lineBottom}
            stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} strokeLinecap="round" />
        )}
        <circle cx={xPx} cy={yPx} r={5.5} fill="white" stroke="#f59e0b" strokeWidth={2.5} />
        <rect x={bX} y={topY} width={bW} height={bH} rx={bR} ry={bR} fill="#f59e0b" />
        {/* Arrow base centered on balloon (aTip), tip points to exact dot X (xPx) → tilts at edges */}
        <polygon points={`${aTip-6},${arrowBaseY} ${aTip+6},${arrowBaseY} ${xPx},${arrowTipY}`} fill="#f59e0b" />
        <text x={bX+bW/2} y={topY+bH/2+5}
          textAnchor="middle" fill="white" fontWeight="800" fontSize="13"
          fontFamily="Sora,sans-serif">{value} kWh</text>
      </svg>
    );
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>Luce</p>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>Ultimi 15 mesi</p>
        </div>
        <span style={{ color:C.textDim, fontSize:11 }}>kWh</span>
      </div>
      <div ref={wrapRef} style={{ position:"relative", touchAction:"none", userSelect:"none" }}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <ResponsiveContainer width="100%" height={LUCE_H}>
          <AreaChart data={luceData} margin={LUCE_M}>
            <defs>
              <linearGradient id="luceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}    />
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

function GasChart() {
  const wrapRef  = useRef(null);
  const [activeIdx, setActiveIdx] = useState(null);

  const getIdx = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX  = clientX - rect.left;
    const innerW = rect.width - GAS_M.left - GAS_M.right;
    const step   = innerW / gasData.length;
    return Math.max(0, Math.min(gasData.length-1, Math.floor((relX - GAS_M.left) / step)));
  };

  const onMouseMove  = (e) => setActiveIdx(getIdx(e.clientX));
  const onMouseLeave = ()  => setActiveIdx(null);
  const onTouchMove  = (e) => { e.preventDefault(); setActiveIdx(getIdx(e.touches[0].clientX)); };
  const onTouchEnd   = ()  => setActiveIdx(null);

  const PillBar = ({ x, y, width, height, index }) => {
    const r=Math.min(width/2, 7), isActive=index===activeIdx;
    const bgTop=GAS_M.top, bgH=GAS_PH;
    return (
      <g>
        <rect x={x} y={bgTop} width={width} height={Math.max(bgH,r*2)} rx={r} ry={r} fill="#1c2a30" />
        <rect x={x} y={y}    width={width} height={Math.max(height,r*2)} rx={r} ry={r}
          fill={isActive?"#7dd3fc":"#38bdf8"} />
      </g>
    );
  };

  const renderOverlay = () => {
    if (activeIdx===null) return null;
    const w     = wrapRef.current?.offsetWidth ?? 320;
    const innerW = w - GAS_M.left - GAS_M.right;
    const step   = innerW / gasData.length;
    const barCx  = GAS_M.left + activeIdx*step + step/2;
    const value  = gasData[activeIdx].smc;
    const bW=88, bH=30, bR=15, BY=5;
    const bX   = Math.max(GAS_M.left, Math.min(w-GAS_M.right-bW, barCx-bW/2));
    const aTip = Math.max(bX+bR, Math.min(bX+bW-bR, barCx));
    const arrowBaseY=BY+bH-2, arrowTipY=BY+bH+10;
    return (
      <svg style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }} width={w} height={GAS_H}>
        <rect x={bX} y={BY} width={bW} height={bH} rx={bR} ry={bR} fill="#38bdf8" />
        <polygon points={`${aTip-5},${arrowBaseY} ${aTip+5},${arrowBaseY} ${aTip},${arrowTipY}`} fill="#38bdf8" />
        <text x={bX+bW/2} y={BY+bH/2+5}
          textAnchor="middle" fill="white" fontWeight="800" fontSize="13"
          fontFamily="Sora,sans-serif">{value} Smc</text>
      </svg>
    );
  };

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.sky, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>Gas</p>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>Ultimi 16 mesi</p>
        </div>
        <span style={{ color:C.textDim, fontSize:11 }}>Smc</span>
      </div>
      <div ref={wrapRef} style={{ position:"relative", touchAction:"none", userSelect:"none" }}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <ResponsiveContainer width="100%" height={GAS_H}>
          <BarChart data={gasData} margin={GAS_M} barCategoryGap="22%">
            <XAxis dataKey="mese" axisLine={false} tickLine={false} height={XAXIS_H}
              tick={{ fill:"#4b5563", fontSize:9 }} interval={0} />
            <YAxis hide domain={[0,MAX_GAS*1.1]} />
            <Bar dataKey="smc" isAnimationActive={false} shape={<PillBar />} />
          </BarChart>
        </ResponsiveContainer>
        {renderOverlay()}
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, paddingBottom:8 }}>
      <div style={{ background:`linear-gradient(135deg,#1a0f00 0%,${C.surface} 60%)`, borderRadius:20, padding:"20px 20px 16px", border:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:140, height:140, borderRadius:"50%", background:`radial-gradient(circle,${C.amberDim} 0%,transparent 70%)` }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Ciao,</p>
            <h1 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif", letterSpacing:-0.5 }}>Marco Vinci</h1>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }} />
              <span style={{ color:C.textMid, fontSize:12 }}>Pagamenti regolari · Milano</span>
            </div>
          </div>
          <button style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:12, padding:10, cursor:"pointer" }}>
            <Bell size={18} color={C.textDim} />
          </button>
        </div>
        <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
          <p style={{ color:C.textDim, fontSize:11, margin:"0 0 4px", letterSpacing:1, textTransform:"uppercase" }}>Spesa annua totale</p>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <span style={{ color:C.text, fontSize:32, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>3.033</span>
            <span style={{ color:C.textMid, fontSize:16 }}>€</span>
            <span style={{ color:C.green, fontSize:12, fontWeight:600, marginLeft:4 }}>↓ risparmi ~365€/anno</span>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <RingCard tipo="Luce" value="5.268" unit="kWh/anno" pct={75} vsYear="-10%"
          prezzo="0,1264 €/kWh" color={C.amber} dimColor={C.amberDim} midColor={C.amberMid}
          icon={<Zap size={18} color={C.amber} />} cardBg={`linear-gradient(135deg,#1a0f00,${C.surface})`} />
        <RingCard tipo="Gas" value="817" unit="Smc/anno" pct={54} vsYear="+5%"
          prezzo="0,5134 €/Smc" color={C.sky} dimColor={C.skyDim} midColor={C.skyMid}
          icon={<Flame size={18} color={C.sky} />} cardBg={`linear-gradient(135deg,#001824,${C.surface})`} />
      </div>

      <LuceChart />
      <GasChart />

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>Ultime bollette</p>
          <button style={{ background:"none", border:"none", color:C.textDim, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:3 }}>Tutte <ChevronRight size={13} /></button>
        </div>
        {[
          { tipo:"LUCE", periodo:"Nov–Dic 2025",      data:"19 Gen 2026", importo:"290,00", icon:<Zap   size={14} color={C.amber}/>, dim:C.amberDim },
          { tipo:"GAS",  periodo:"Dic 2025–Gen 2026", data:"2 Mar 2026",  importo:"291,00", icon:<Flame size={14} color={C.sky  }/>, dim:C.skyDim   },
        ].map((b,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface2, borderRadius:14, padding:"13px 14px", marginBottom:i===0?10:0, border:`1px solid ${C.border2}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ background:b.dim, borderRadius:10, padding:9 }}>{b.icon}</div>
              <div>
                <p style={{ color:C.text, fontSize:13, fontWeight:600, margin:0 }}>{b.tipo} · {b.periodo}</p>
                <p style={{ color:C.textDim, fontSize:11, margin:"2px 0 0" }}>{b.data}</p>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ color:C.text, fontSize:16, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>{b.importo} €</p>
              <span style={{ background:C.greenDim, color:C.green, fontSize:10, borderRadius:20, padding:"2px 8px", fontWeight:600 }}>pagata</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MercatoScreen() {
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
        { label:"PUN · Luce", icon:<Zap   size={14} color={C.amber}/>, color:C.amber, dim:C.amberDim, mid:C.amberMid, value:"0,152", unit:"€/kWh", trend:"+8,5% vs Febbraio", tua:"0,1264", risparmio:"~240€/anno", bg:`linear-gradient(135deg,#1a0f00,${C.surface})` },
        { label:"PSV · Gas",  icon:<Flame size={14} color={C.sky  }/>, color:C.sky,   dim:C.skyDim,   mid:C.skyMid,   value:"0,567", unit:"€/Smc", trend:"+12% vs Febbraio",  tua:"0,5134", risparmio:"~125€/anno", bg:`linear-gradient(135deg,#001824,${C.surface})` },
      ].map((m,i) => (
        <div key={i} style={{ background:m.bg, border:`1px solid ${m.mid}`, borderRadius:20, padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ background:m.dim, borderRadius:8, padding:6 }}>{m.icon}</div>
                <span style={{ color:m.color, fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" }}>{m.label}</span>
                <span style={{ background:m.dim, color:m.color, fontSize:10, fontWeight:700, borderRadius:20, padding:"2px 8px" }}>Oggi</span>
              </div>
              <p style={{ color:C.text, fontSize:34, fontWeight:800, margin:"0 0 4px", fontFamily:"'Sora',sans-serif" }}>
                {m.value} <span style={{ fontSize:14, color:C.textMid }}>{m.unit}</span>
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <TrendingUp size={12} color={C.red} />
                <span style={{ color:C.red, fontSize:12, fontWeight:600 }}>{m.trend}</span>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <span style={{ background:C.greenDim, color:C.green, fontSize:11, borderRadius:20, padding:"4px 10px", fontWeight:700 }}>La tua: {m.tua}</span>
              <p style={{ color:C.green, fontSize:11, margin:"6px 0 0", fontWeight:600 }}>Risparmi {m.risparmio}</p>
            </div>
          </div>
        </div>
      ))}
      <div style={{ background:"#0d1a0d", border:`1px solid ${C.green}33`, borderRadius:18, padding:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <CheckCircle size={18} color={C.green} />
          <p style={{ color:C.green, fontSize:14, fontWeight:700, margin:0 }}>Tariffe attualmente convenienti</p>
        </div>
        <p style={{ color:C.textMid, fontSize:13, margin:"0 0 14px", lineHeight:1.6 }}>Con le offerte Extra2a in scadenza ad ottobre 2026 stai risparmiando su entrambe le utenze. Non conviene cambiare ora.</p>
        <div style={{ background:C.surface, borderRadius:12, padding:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          {[["Risparmio luce","~240€"],["Risparmio gas","~125€"],["Totale","~365€"]].map(([l,v],i,arr) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ textAlign:"center" }}>
                <p style={{ color:C.textDim, fontSize:10, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:1 }}>{l}</p>
                <p style={{ color:C.green, fontSize:18, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>{v}</p>
              </div>
              {i<arr.length-1 && <div style={{ width:1, height:36, background:C.border }} />}
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:C.textMid, fontSize:12, fontWeight:600, margin:"0 0 2px" }}>Fonte dati</p>
          <p style={{ color:C.textDim, fontSize:11, margin:0 }}>GME · Aggiornato oggi, 9 Mar 2026</p>
        </div>
        <ArrowUpRight size={16} color={C.textDim} />
      </div>
    </div>
  );
}

function SettingsScreen() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:8 }}>
      <div>
        <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Profilo</p>
        <h2 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>Impostazioni</h2>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:20, display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${C.amber},#ef4444)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fff", flexShrink:0 }}>MV</div>
        <div>
          <p style={{ color:C.text, fontSize:16, fontWeight:700, margin:"0 0 3px", fontFamily:"'Sora',sans-serif" }}>Marco Vinci</p>
          <p style={{ color:C.textDim, fontSize:12, margin:"0 0 6px" }}>Via P. C. Decembrio 19, Milano</p>
          <span style={{ background:C.greenDim, color:C.green, fontSize:10, borderRadius:20, padding:"3px 10px", fontWeight:700 }}>Account attivo</span>
        </div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:18 }}>
        <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Le tue forniture</p>
        {[
          { tipo:"LUCE", cod:"IT012E00367605", fornitore:"A2A Energia", offerta:"Extra2a Luce", scad:"31.10.2026", color:C.amber, icon:<Zap   size={14} color={C.amber}/>, dim:C.amberDim },
          { tipo:"GAS",  cod:"05260200451415", fornitore:"A2A Energia", offerta:"Extra2a Gas",  scad:"31.10.2026", color:C.sky,   icon:<Flame size={14} color={C.sky  }/>, dim:C.skyDim   },
        ].map((f,i) => (
          <div key={i} style={{ background:C.surface2, borderRadius:14, padding:14, border:`1px solid ${C.border2}`, marginBottom:i===0?10:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ background:f.dim, borderRadius:8, padding:7 }}>{f.icon}</div>
              <span style={{ color:f.color, fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>{f.tipo}</span>
            </div>
            {[["Codice",f.cod],["Fornitore",f.fornitore],["Offerta",f.offerta],["Scadenza",f.scad]].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ color:C.textDim, fontSize:12 }}>{k}</span>
                <span style={{ color:C.text, fontSize:12, fontWeight:600, fontFamily:k==="Codice"?"monospace":"inherit" }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
        <p style={{ color:C.textMid, fontSize:12, fontWeight:700, margin:"0 0 12px" }}>🔜 Prossimamente</p>
        {["Login con Google","Dati live dal Portale ARERA","Alert scadenza offerta","Confronto fornitori"].map((t,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:i<3?10:0 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:C.border2, flexShrink:0 }} />
            <p style={{ color:C.textDim, fontSize:12, margin:0 }}>{t}</p>
          </div>
        ))}
      </div>
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
          <span style={{ color:C.textDim, fontSize:12, fontWeight:600 }}>9:41</span>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ display:"flex", gap:2 }}>{[3,4,5,6].map(h=><div key={h} style={{ width:3, height:h, background:C.textMid, borderRadius:1 }}/>)}</div>
            <div style={{ width:16, height:8, border:`1.5px solid ${C.textMid}`, borderRadius:2, position:"relative" }}>
              <div style={{ position:"absolute", right:-4, top:"50%", transform:"translateY(-50%)", width:3, height:4, background:C.textMid, borderRadius:"0 1px 1px 0" }} />
              <div style={{ width:"70%", height:"100%", background:C.green, borderRadius:1 }} />
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px 16px 100px" }}>
          {tab==="home"     && <Dashboard     />}
          {tab==="upload"   && <UploadScreen  />}
          {tab==="mercato"  && <MercatoScreen />}
          {tab==="settings" && <SettingsScreen/>}
        </div>
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:`${C.surface}ee`, backdropFilter:"blur(20px)", borderTop:`1px solid ${C.border}`, padding:"8px 8px 20px", display:"flex", justifyContent:"space-around", zIndex:100 }}>
          {nav.map(({ id, icon:Icon, label }) => {
            const active=tab===id;
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
