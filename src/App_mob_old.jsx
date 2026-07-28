import { useState, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Zap, Flame, Home, Upload, BarChart2, Settings,
  TrendingDown, TrendingUp, CheckCircle, AlertTriangle,
  ChevronRight, Camera, FileText, Bell, RefreshCw,
  ArrowUpRight, Wallet, Calendar
} from "lucide-react";

// ── DATA ─────────────────────────────────────────────────────────────────────
const luceData = [
  { m: "O", kwh: 461 }, { m: "N", kwh: 451 }, { m: "D", kwh: 552 },
  { m: "G", kwh: 527 }, { m: "F", kwh: 428 }, { m: "M", kwh: 429 },
  { m: "A", kwh: 471 }, { m: "M", kwh: 488 }, { m: "G", kwh: 500 },
  { m: "L", kwh: 415 }, { m: "A", kwh: 355 }, { m: "S", kwh: 312 },
  { m: "O", kwh: 364 }, { m: "N", kwh: 451 }, { m: "D", kwh: 528 },
];

const gasData = [
  { m: "O", smc: 40 }, { m: "N", smc: 92 }, { m: "D", smc: 158 },
  { m: "G", smc: 163 }, { m: "F", smc: 123 }, { m: "M", smc: 89 },
  { m: "A", smc: 62 }, { m: "M", smc: 50 }, { m: "G", smc: 35 },
  { m: "L", smc: 35 }, { m: "A", smc: 23 }, { m: "S", smc: 19 },
  { m: "O", smc: 33 }, { m: "N", smc: 69 }, { m: "D", smc: 113 },
  { m: "G", smc: 150 },
];

const PUN = 0.152, PSV = 0.567;
const LUCE_FISSO = 0.12636, GAS_FISSO = 0.513393;

// ── STYLES ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#080808", surface: "#111111", surface2: "#181818",
  border: "#1e1e1e", border2: "#252525",
  amber: "#f59e0b", amberDim: "#f59e0b18", amberMid: "#f59e0b35",
  sky: "#38bdf8", skyDim: "#38bdf818", skyMid: "#38bdf835",
  green: "#22c55e", greenDim: "#22c55e18",
  red: "#ef4444", redDim: "#ef444418",
  text: "#ffffff", textMid: "#9ca3af", textDim: "#4b5563",
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const luceDiff = LUCE_FISSO - (PUN + 0.02);
const gasDiff = GAS_FISSO - (PSV + 0.10);

// ── CUSTOM TOOLTIP ────────────────────────────────────────────────────────────
const TooltipLuce = ({ active, payload }) => active && payload?.length ? (
  <div style={{ background: C.surface, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "8px 12px" }}>
    <p style={{ color: C.amber, fontWeight: 700, margin: 0, fontSize: 13 }}>{payload[0].value} kWh</p>
  </div>
) : null;

const TooltipGas = ({ active, payload }) => active && payload?.length ? (
  <div style={{ background: C.surface, border: `1px solid ${C.sky}`, borderRadius: 8, padding: "8px 12px" }}>
    <p style={{ color: C.sky, fontWeight: 700, margin: 0, fontSize: 13 }}>{payload[0].value} Smc</p>
  </div>
) : null;

// ── SCREENS ───────────────────────────────────────────────────────────────────

function Dashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>

      {/* Hero greeting */}
      <div style={{
        background: `linear-gradient(135deg, #1a0f00 0%, ${C.surface} 60%)`,
        borderRadius: 20, padding: "20px 20px 16px",
        border: `1px solid ${C.border}`, position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 140, height: 140, borderRadius: "50%",
          background: `radial-gradient(circle, ${C.amberDim} 0%, transparent 70%)`
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ color: C.textDim, fontSize: 12, margin: "0 0 4px", letterSpacing: 2, textTransform: "uppercase" }}>Ciao,</p>
            <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif", letterSpacing: -0.5 }}>
              Marco Vinci
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
              <span style={{ color: C.textMid, fontSize: 12 }}>Pagamenti regolari · Milano</span>
            </div>
          </div>
          <button style={{ background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 10, cursor: "pointer" }}>
            <Bell size={18} color={C.textDim} />
          </button>
        </div>

        {/* Spesa totale annua */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <p style={{ color: C.textDim, fontSize: 11, margin: "0 0 4px", letterSpacing: 1, textTransform: "uppercase" }}>Spesa annua totale</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ color: C.text, fontSize: 32, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>3.033</span>
            <span style={{ color: C.textMid, fontSize: 16 }}>€</span>
            <span style={{ color: C.green, fontSize: 12, fontWeight: 600, marginLeft: 4 }}>↓ stai risparmiando ~365€/anno</span>
          </div>
        </div>
      </div>

      {/* Luce + Gas cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Luce */}
        <div style={{
          background: C.surface, border: `1px solid ${C.amberMid}`,
          borderRadius: 18, padding: 16, position: "relative", overflow: "hidden"
        }}>
          <div style={{ position: "absolute", bottom: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: C.amberDim }} />
          <div style={{ background: C.amberDim, borderRadius: 10, padding: 8, display: "inline-flex", marginBottom: 12 }}>
            <Zap size={16} color={C.amber} />
          </div>
          <p style={{ color: C.textDim, fontSize: 10, margin: "0 0 4px", letterSpacing: 1, textTransform: "uppercase" }}>Luce</p>
          <p style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: "0 0 2px", fontFamily: "'Sora', sans-serif" }}>5.268</p>
          <p style={{ color: C.textDim, fontSize: 11, margin: "0 0 10px" }}>kWh/anno</p>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingDown size={12} color={C.green} />
            <span style={{ color: C.green, fontSize: 11, fontWeight: 600 }}>Conveniente</span>
          </div>
          <p style={{ color: C.textDim, fontSize: 10, margin: "4px 0 0" }}>0,1264 €/kWh</p>
        </div>

        {/* Gas */}
        <div style={{
          background: C.surface, border: `1px solid ${C.skyMid}`,
          borderRadius: 18, padding: 16, position: "relative", overflow: "hidden"
        }}>
          <div style={{ position: "absolute", bottom: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: C.skyDim }} />
          <div style={{ background: C.skyDim, borderRadius: 10, padding: 8, display: "inline-flex", marginBottom: 12 }}>
            <Flame size={16} color={C.sky} />
          </div>
          <p style={{ color: C.textDim, fontSize: 10, margin: "0 0 4px", letterSpacing: 1, textTransform: "uppercase" }}>Gas</p>
          <p style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: "0 0 2px", fontFamily: "'Sora', sans-serif" }}>817</p>
          <p style={{ color: C.textDim, fontSize: 11, margin: "0 0 10px" }}>Smc/anno</p>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingDown size={12} color={C.green} />
            <span style={{ color: C.green, fontSize: 11, fontWeight: 600 }}>Conveniente</span>
          </div>
          <p style={{ color: C.textDim, fontSize: 10, margin: "4px 0 0" }}>0,5134 €/Smc</p>
        </div>
      </div>

      {/* Grafico Luce */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "18px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ color: C.amber, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, margin: "0 0 3px", textTransform: "uppercase" }}>Elettricità</p>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Ultimi 15 mesi</p>
          </div>
          <span style={{ color: C.textDim, fontSize: 11 }}>kWh</span>
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={luceData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.amber} stopOpacity={0.35} />
                <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="m" tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<TooltipLuce />} />
            <Area type="monotone" dataKey="kwh" stroke={C.amber} strokeWidth={2} fill="url(#lg)" dot={false} activeDot={{ r: 3, fill: C.amber }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Grafico Gas */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "18px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ color: C.sky, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, margin: "0 0 3px", textTransform: "uppercase" }}>Gas</p>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Ultimi 16 mesi</p>
          </div>
          <span style={{ color: C.textDim, fontSize: 11 }}>Smc</span>
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={gasData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="m" tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<TooltipGas />} />
            <Bar dataKey="smc" fill={C.sky} radius={[3, 3, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ultime bollette */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Ultime bollette</p>
          <button style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            Tutte <ChevronRight size={13} />
          </button>
        </div>
        {[
          { tipo: "LUCE", periodo: "Nov–Dic 2025", data: "19 Gen 2026", importo: "290,00", color: C.amber, icon: <Zap size={14} color={C.amber} />, dim: C.amberDim },
          { tipo: "GAS", periodo: "Dic 2025–Gen 2026", data: "2 Mar 2026", importo: "291,00", color: C.sky, icon: <Flame size={14} color={C.sky} />, dim: C.skyDim },
        ].map((b, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: C.surface2, borderRadius: 14, padding: "13px 14px",
            marginBottom: i === 0 ? 10 : 0, border: `1px solid ${C.border2}`
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: b.dim, borderRadius: 10, padding: 9 }}>{b.icon}</div>
              <div>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 600, margin: 0 }}>{b.tipo} · {b.periodo}</p>
                <p style={{ color: C.textDim, fontSize: 11, margin: "2px 0 0" }}>{b.data}</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ color: C.text, fontSize: 16, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>{b.importo} €</p>
              <span style={{ background: C.greenDim, color: C.green, fontSize: 10, borderRadius: 20, padding: "2px 8px", fontWeight: 600 }}>pagata</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UPLOAD SCREEN ─────────────────────────────────────────────────────────────
function UploadScreen() {
  const [mode, setMode] = useState(null); // null | "pdf" | "photo"
  const [files, setFiles] = useState([]);
  const fileRef = useRef();
  const imgRef = useRef();

  const addFile = (f, type) => {
    const entry = { name: f.name || `Foto_${Date.now()}.jpg`, size: (f.size / 1024).toFixed(0) + " KB", status: "analisi...", type };
    setFiles(prev => [...prev, entry]);
    setTimeout(() => setFiles(prev => prev.map((x, i) => i === prev.length - 1 ? { ...x, status: "estratto" } : x)), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
      <div>
        <p style={{ color: C.textDim, fontSize: 12, margin: "0 0 4px", letterSpacing: 2, textTransform: "uppercase" }}>Importa</p>
        <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>Carica bolletta</h2>
      </div>

      {/* Mode selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button onClick={() => { setMode("pdf"); fileRef.current?.click(); }} style={{
          background: mode === "pdf" ? C.amberDim : C.surface,
          border: `1.5px solid ${mode === "pdf" ? C.amber : C.border}`,
          borderRadius: 18, padding: "20px 16px", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all 0.2s"
        }}>
          <div style={{ background: C.amberDim, borderRadius: 12, padding: 12 }}>
            <FileText size={24} color={C.amber} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.text, fontSize: 13, fontWeight: 700, margin: "0 0 3px" }}>Carica PDF</p>
            <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>Dal tuo dispositivo</p>
          </div>
        </button>

        <button onClick={() => { setMode("photo"); imgRef.current?.click(); }} style={{
          background: mode === "photo" ? C.skyDim : C.surface,
          border: `1.5px solid ${mode === "photo" ? C.sky : C.border}`,
          borderRadius: 18, padding: "20px 16px", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all 0.2s"
        }}>
          <div style={{ background: C.skyDim, borderRadius: 12, padding: 12 }}>
            <Camera size={24} color={C.sky} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.text, fontSize: 13, fontWeight: 700, margin: "0 0 3px" }}>Fotografa</p>
            <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>Scatta o carica foto</p>
          </div>
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
        onChange={e => e.target.files[0] && addFile(e.target.files[0], "pdf")} />
      <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={e => e.target.files[0] && addFile(e.target.files[0], "photo")} />

      {/* Info box */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
        <p style={{ color: C.textMid, fontSize: 12, fontWeight: 600, margin: "0 0 10px" }}>💡 Come funziona</p>
        {[
          "Carica il PDF oppure fotografa la bolletta",
          "L'AI estrae automaticamente prezzi, consumi e POD/PDR",
          "I dati vengono confrontati con i prezzi di mercato",
        ].map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
            <div style={{ background: C.amberDim, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              <span style={{ color: C.amber, fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
            </div>
            <p style={{ color: C.textMid, fontSize: 12, margin: 0, lineHeight: 1.5 }}>{t}</p>
          </div>
        ))}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>File caricati</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {files.map((f, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: C.surface2, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.border2}`
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: f.type === "pdf" ? C.amberDim : C.skyDim, borderRadius: 8, padding: 7 }}>
                    {f.type === "pdf" ? <FileText size={14} color={C.amber} /> : <Camera size={14} color={C.sky} />}
                  </div>
                  <div>
                    <p style={{ color: C.text, fontSize: 12, fontWeight: 600, margin: 0 }}>{f.name}</p>
                    <p style={{ color: C.textDim, fontSize: 10, margin: "2px 0 0" }}>{f.size}</p>
                  </div>
                </div>
                <span style={{
                  background: f.status === "estratto" ? C.greenDim : C.amberDim,
                  color: f.status === "estratto" ? C.green : C.amber,
                  fontSize: 10, borderRadius: 20, padding: "3px 10px", fontWeight: 700
                }}>{f.status}</span>
              </div>
            ))}
          </div>

          {files.some(f => f.status === "estratto") && (
            <div style={{ marginTop: 14, background: "#0d1a0d", border: `1px solid ${C.green}33`, borderRadius: 14, padding: 16 }}>
              <p style={{ color: C.green, fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>✓ Dati estratti</p>
              {[
                ["POD", "IT012E00367605"], ["PDR", "05260200451415"],
                ["Tariffa Luce", "0,12636 €/kWh"], ["Tariffa Gas", "0,51339 €/Smc"],
                ["Fornitore", "A2A Energia"], ["Scadenza offerta", "31.10.2026"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: C.textDim, fontSize: 12 }}>{k}</span>
                  <span style={{ color: C.text, fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fornitori */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
        <p style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, margin: "0 0 12px", textTransform: "uppercase" }}>Fornitori supportati</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {["A2A", "Enel", "Eni", "Edison", "Hera", "Engie", "E.ON", "Sorgenia", "Iren", "Acea", "Pulsee"].map(p => (
            <span key={p} style={{
              background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 20,
              padding: "5px 12px", color: C.textMid, fontSize: 11, fontWeight: 500
            }}>{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MERCATO SCREEN ────────────────────────────────────────────────────────────
function MercatoScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: C.textDim, fontSize: 12, margin: "0 0 4px", letterSpacing: 2, textTransform: "uppercase" }}>Live</p>
          <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>Mercato</h2>
        </div>
        <button style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} color={C.textDim} />
          <span style={{ color: C.textDim, fontSize: 11 }}>Aggiorna</span>
        </button>
      </div>

      {/* PUN */}
      <div style={{
        background: `linear-gradient(135deg, #1a0f00, ${C.surface})`,
        border: `1px solid ${C.amberMid}`, borderRadius: 20, padding: 20
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ background: C.amberDim, borderRadius: 8, padding: 6 }}>
                <Zap size={14} color={C.amber} />
              </div>
              <span style={{ color: C.amber, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>PUN · Luce</span>
            </div>
            <p style={{ color: C.text, fontSize: 34, fontWeight: 800, margin: "0 0 4px", fontFamily: "'Sora', sans-serif" }}>
              0,152 <span style={{ fontSize: 14, color: C.textMid }}>€/kWh</span>
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={12} color={C.red} />
              <span style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>+8,5% vs Febbraio</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ background: C.greenDim, color: C.green, fontSize: 11, borderRadius: 20, padding: "4px 10px", fontWeight: 700 }}>
              La tua: 0,1264
            </span>
            <p style={{ color: C.green, fontSize: 11, margin: "6px 0 0", fontWeight: 600 }}>Risparmi ~240€/anno</p>
          </div>
        </div>
      </div>

      {/* PSV */}
      <div style={{
        background: `linear-gradient(135deg, #001824, ${C.surface})`,
        border: `1px solid ${C.skyMid}`, borderRadius: 20, padding: 20
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ background: C.skyDim, borderRadius: 8, padding: 6 }}>
                <Flame size={14} color={C.sky} />
              </div>
              <span style={{ color: C.sky, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>PSV · Gas</span>
            </div>
            <p style={{ color: C.text, fontSize: 34, fontWeight: 800, margin: "0 0 4px", fontFamily: "'Sora', sans-serif" }}>
              0,567 <span style={{ fontSize: 14, color: C.textMid }}>€/Smc</span>
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={12} color={C.red} />
              <span style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>+12% vs Febbraio</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ background: C.greenDim, color: C.green, fontSize: 11, borderRadius: 20, padding: "4px 10px", fontWeight: 700 }}>
              La tua: 0,5134
            </span>
            <p style={{ color: C.green, fontSize: 11, margin: "6px 0 0", fontWeight: 600 }}>Risparmi ~125€/anno</p>
          </div>
        </div>
      </div>

      {/* Consiglio */}
      <div style={{ background: "#0d1a0d", border: `1px solid ${C.green}33`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <CheckCircle size={18} color={C.green} />
          <p style={{ color: C.green, fontSize: 14, fontWeight: 700, margin: 0 }}>Tariffe attualmente convenienti</p>
        </div>
        <p style={{ color: C.textMid, fontSize: 13, margin: "0 0 14px", lineHeight: 1.6 }}>
          Con le offerte Extra2a in scadenza ad ottobre 2026, stai risparmiando sia su luce che su gas rispetto al mercato variabile attuale. Non conviene cambiare fornitore ora.
        </p>
        <div style={{ background: C.surface, borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.textDim, fontSize: 10, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Risparmio luce</p>
            <p style={{ color: C.green, fontSize: 18, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>~240€</p>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.textDim, fontSize: 10, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Risparmio gas</p>
            <p style={{ color: C.green, fontSize: 18, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>~125€</p>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.textDim, fontSize: 10, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Totale</p>
            <p style={{ color: C.green, fontSize: 18, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>~365€</p>
          </div>
        </div>
      </div>

      {/* Fonte dati */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ color: C.textMid, fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>Fonte dati</p>
          <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>GME · Aggiornato oggi, 8 Mar 2026</p>
        </div>
        <ArrowUpRight size={16} color={C.textDim} />
      </div>
    </div>
  );
}

// ── SETTINGS SCREEN ───────────────────────────────────────────────────────────
function SettingsScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
      <div>
        <p style={{ color: C.textDim, fontSize: 12, margin: "0 0 4px", letterSpacing: 2, textTransform: "uppercase" }}>Profilo</p>
        <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>Impostazioni</h2>
      </div>

      {/* Avatar */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.amber}, #ef4444)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 800, color: "#fff", flexShrink: 0
        }}>MV</div>
        <div>
          <p style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: "0 0 3px", fontFamily: "'Sora', sans-serif" }}>Marco Vinci</p>
          <p style={{ color: C.textDim, fontSize: 12, margin: "0 0 6px" }}>Via P. C. Decembrio 19, Milano</p>
          <span style={{ background: C.greenDim, color: C.green, fontSize: 10, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>Account attivo</span>
        </div>
      </div>

      {/* Forniture */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18 }}>
        <p style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Le tue forniture</p>
        {[
          { tipo: "LUCE", pod: "IT012E00367605", fornitore: "A2A Energia", offerta: "Extra2a Luce", scad: "31.10.2026", color: C.amber, icon: <Zap size={14} color={C.amber} />, dim: C.amberDim },
          { tipo: "GAS", pod: "05260200451415", fornitore: "A2A Energia", offerta: "Extra2a Gas", scad: "31.10.2026", color: C.sky, icon: <Flame size={14} color={C.sky} />, dim: C.skyDim },
        ].map((f, i) => (
          <div key={i} style={{
            background: C.surface2, borderRadius: 14, padding: "14px",
            border: `1px solid ${C.border2}`, marginBottom: i === 0 ? 10 : 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ background: f.dim, borderRadius: 8, padding: 7 }}>{f.icon}</div>
              <span style={{ color: f.color, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{f.tipo}</span>
            </div>
            {[
              ["Codice", f.pod],
              ["Fornitore", f.fornitore],
              ["Offerta", f.offerta],
              ["Scadenza", f.scad],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: C.textDim, fontSize: 12 }}>{k}</span>
                <span style={{ color: C.text, fontSize: 12, fontWeight: 600, fontFamily: k === "Codice" ? "monospace" : "inherit" }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Prossimi step */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
        <p style={{ color: C.textMid, fontSize: 12, fontWeight: 700, margin: "0 0 12px" }}>🔜 Prossimamente</p>
        {["Login con Google", "Dati live dal Portale ARERA", "Alert scadenza offerta", "Confronto fornitori"].map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 3 ? 10 : 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.border2, flexShrink: 0 }} />
            <p style={{ color: C.textDim, fontSize: 12, margin: 0 }}>{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("home");

  const nav = [
    { id: "home", icon: Home, label: "Home" },
    { id: "upload", icon: Upload, label: "Bollette" },
    { id: "mercato", icon: BarChart2, label: "Mercato" },
    { id: "settings", icon: Settings, label: "Profilo" },
  ];

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#050505", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        body { background: #050505; }
      `}</style>

      {/* Phone frame */}
      <div style={{
        width: "100%", maxWidth: 430, minHeight: "100vh",
        background: C.bg, display: "flex", flexDirection: "column",
        position: "relative", fontFamily: "'DM Sans', sans-serif"
      }}>
        {/* Status bar sim */}
        <div style={{
          height: 44, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 20px", flexShrink: 0
        }}>
          <span style={{ color: C.textDim, fontSize: 12, fontWeight: 600 }}>9:41</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 2 }}>
              {[3, 4, 5, 6].map(h => <div key={h} style={{ width: 3, height: h, background: C.textMid, borderRadius: 1 }} />)}
            </div>
            <div style={{ width: 16, height: 8, border: `1.5px solid ${C.textMid}`, borderRadius: 2, position: "relative" }}>
              <div style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", width: 3, height: 4, background: C.textMid, borderRadius: "0 1px 1px 0" }} />
              <div style={{ width: "70%", height: "100%", background: C.green, borderRadius: 1 }} />
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 100px" }}>
          {tab === "home" && <Dashboard />}
          {tab === "upload" && <UploadScreen />}
          {tab === "mercato" && <MercatoScreen />}
          {tab === "settings" && <SettingsScreen />}
        </div>

        {/* Bottom Navigation */}
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430,
          background: `${C.surface}ee`, backdropFilter: "blur(20px)",
          borderTop: `1px solid ${C.border}`, padding: "8px 8px 20px",
          display: "flex", justifyContent: "space-around", zIndex: 100
        }}>
          {nav.map(({ id, icon: Icon, label }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", padding: "8px 4px",
                borderRadius: 14, transition: "all 0.15s",
              }}>
                <div style={{
                  background: active ? C.amberDim : "transparent",
                  borderRadius: 12, padding: "6px 16px", transition: "all 0.2s"
                }}>
                  <Icon size={20} color={active ? C.amber : C.textDim} strokeWidth={active ? 2.5 : 1.5} />
                </div>
                <span style={{
                  fontSize: 10, fontWeight: active ? 700 : 400,
                  color: active ? C.amber : C.textDim, letterSpacing: 0.3
                }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}