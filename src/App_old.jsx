import { useState, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Upload, Zap, Flame, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Home, FileText, BarChart2, Settings, Bell } from "lucide-react";

// ── DATA ─────────────────────────────────────────────────────────────────────
const luceData = [
  { mese: "Ott", kwh: 461, costo: 92 }, { mese: "Nov", kwh: 451, costo: 90 },
  { mese: "Dic", kwh: 552, costo: 110 }, { mese: "Gen", kwh: 527, costo: 105 },
  { mese: "Feb", kwh: 428, costo: 86 }, { mese: "Mar", kwh: 429, costo: 86 },
  { mese: "Apr", kwh: 471, costo: 94 }, { mese: "Mag", kwh: 488, costo: 98 },
  { mese: "Giu", kwh: 500, costo: 100 }, { mese: "Lug", kwh: 415, costo: 83 },
  { mese: "Ago", kwh: 355, costo: 71 }, { mese: "Set", kwh: 312, costo: 62 },
  { mese: "Ott", kwh: 364, costo: 73 }, { mese: "Nov", kwh: 451, costo: 90 },
  { mese: "Dic", kwh: 528, costo: 106 },
];

const gasData = [
  { mese: "Ott", smc: 40, costo: 30 }, { mese: "Nov", smc: 92, costo: 68 },
  { mese: "Dic", smc: 158, costo: 117 }, { mese: "Gen", smc: 163, costo: 121 },
  { mese: "Feb", smc: 123, costo: 91 }, { mese: "Mar", smc: 89, costo: 66 },
  { mese: "Apr", smc: 62, costo: 46 }, { mese: "Mag", smc: 50, costo: 37 },
  { mese: "Giu", smc: 35, costo: 26 }, { mese: "Lug", smc: 35, costo: 26 },
  { mese: "Ago", smc: 23, costo: 17 }, { mese: "Set", smc: 19, costo: 14 },
  { mese: "Ott", smc: 33, costo: 24 }, { mese: "Nov", smc: 69, costo: 51 },
  { mese: "Dic", smc: 113, costo: 84 }, { mese: "Gen", smc: 150, costo: 111 },
];

const PREZZI_MERCATO = { PUN: 0.152, PSV: 0.567 };
const BOLLETTE = [
  { id: 1, tipo: "LUCE", data: "19 Gen 2026", importo: 290.00, kwh: 979, periodo: "Nov–Dic 2025", status: "pagata" },
  { id: 2, tipo: "GAS", data: "2 Mar 2026", importo: 291.00, smc: 262.4, periodo: "Dic 2025–Gen 2026", status: "pagata" },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
function analizzaTariffa(tipo, prezzoFisso, mercato) {
  const spread = tipo === "LUCE" ? 0.02 : 0.10;
  const prezzoMercato = mercato + spread;
  const diff = prezzoFisso - prezzoMercato;
  return { conveniente: diff < 0, diff: Math.abs(diff), prezzoMercato };
}

const luceStat = analizzaTariffa("LUCE", 0.12636, PREZZI_MERCATO.PUN);
const gasStat = analizzaTariffa("GAS", 0.513393, PREZZI_MERCATO.PSV);

// ── COMPONENTS ───────────────────────────────────────────────────────────────
const CustomTooltipLuce = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div style={{ background: "#1a1a1a", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ color: "#f59e0b", fontWeight: 700, margin: 0 }}>{label}</p>
      <p style={{ color: "#fff", margin: "4px 0 0" }}>{payload[0].value} kWh</p>
    </div>
  );
  return null;
};

const CustomTooltipGas = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div style={{ background: "#1a1a1a", border: "1px solid #38bdf8", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ color: "#38bdf8", fontWeight: 700, margin: 0 }}>{label}</p>
      <p style={{ color: "#fff", margin: "4px 0 0" }}>{payload[0].value} Smc</p>
    </div>
  );
  return null;
};

// ── SCREENS ──────────────────────────────────────────────────────────────────
function Dashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>Benvenuto</p>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "4px 0 0", fontFamily: "'Sora', sans-serif" }}>
            Marco Vinci
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <span style={{ color: "#6b7280", fontSize: 12 }}>Pagamenti regolari</span>
          </div>
        </div>
      </div>

      {/* Tariff Alert Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Luce Card */}
        <div style={{
          background: "linear-gradient(135deg, #1c1400 0%, #0f0f0f 100%)",
          border: `1px solid ${luceStat.conveniente ? "#f59e0b55" : "#ef444455"}`,
          borderRadius: 16, padding: 20, position: "relative", overflow: "hidden"
        }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "#f59e0b0a" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#f59e0b22", borderRadius: 8, padding: 6 }}>
                  <Zap size={16} color="#f59e0b" />
                </div>
                <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Energia Elettrica</span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 4px" }}>Prezzo fisso attuale</p>
              <p style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>
                0,1264 <span style={{ fontSize: 14, color: "#9ca3af" }}>€/kWh</span>
              </p>
              <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>PUN mercato: {PREZZI_MERCATO.PUN.toFixed(3)} €/kWh</p>
            </div>
            <div style={{ textAlign: "right" }}>
              {luceStat.conveniente
                ? <CheckCircle size={20} color="#22c55e" />
                : <AlertTriangle size={20} color="#ef4444" />}
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #ffffff0a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {luceStat.conveniente
                ? <TrendingDown size={14} color="#22c55e" />
                : <TrendingUp size={14} color="#ef4444" />}
              <span style={{ color: luceStat.conveniente ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
                {luceStat.conveniente ? `Risparmi ${(luceStat.diff * 5268).toFixed(0)}€/anno` : `Costi ${(luceStat.diff * 5268).toFixed(0)}€/anno in più`}
              </span>
            </div>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>Extra2a Luce · scade 31.10.2026</p>
          </div>
        </div>

        {/* Gas Card */}
        <div style={{
          background: "linear-gradient(135deg, #001a24 0%, #0f0f0f 100%)",
          border: `1px solid ${gasStat.conveniente ? "#38bdf855" : "#ef444455"}`,
          borderRadius: 16, padding: 20, position: "relative", overflow: "hidden"
        }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "#38bdf80a" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#38bdf822", borderRadius: 8, padding: 6 }}>
                  <Flame size={16} color="#38bdf8" />
                </div>
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Gas Naturale</span>
              </div>
              <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 4px" }}>Prezzo fisso attuale</p>
              <p style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>
                0,5134 <span style={{ fontSize: 14, color: "#9ca3af" }}>€/Smc</span>
              </p>
              <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>PSV mercato: {PREZZI_MERCATO.PSV.toFixed(3)} €/Smc</p>
            </div>
            <div style={{ textAlign: "right" }}>
              {gasStat.conveniente
                ? <CheckCircle size={20} color="#22c55e" />
                : <AlertTriangle size={20} color="#ef4444" />}
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #ffffff0a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {gasStat.conveniente
                ? <TrendingDown size={14} color="#22c55e" />
                : <TrendingUp size={14} color="#ef4444" />}
              <span style={{ color: gasStat.conveniente ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
                {gasStat.conveniente ? `Risparmi ${(gasStat.diff * 817).toFixed(0)}€/anno` : `Costi ${(gasStat.diff * 817).toFixed(0)}€/anno in più`}
              </span>
            </div>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>Extra2a Gas · scade 31.10.2026</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Consumo annuo luce", value: "5.268", unit: "kWh", color: "#f59e0b" },
          { label: "Spesa annua luce", value: "1.941", unit: "€", color: "#f59e0b" },
          { label: "Consumo annuo gas", value: "817", unit: "Smc", color: "#38bdf8" },
          { label: "Spesa annua gas", value: "1.092", unit: "€", color: "#38bdf8" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 6px", letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>
              {s.value} <span style={{ fontSize: 12, color: "#6b7280" }}>{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Luce Chart */}
        <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, margin: "0 0 4px", textTransform: "uppercase" }}>Elettricità</p>
              <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0 }}>Consumi ultimi 15 mesi</p>
            </div>
            <Zap size={18} color="#f59e0b44" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={luceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="luceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis dataKey="mese" tick={{ fill: "#4b5563", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltipLuce />} />
              <Area type="monotone" dataKey="kwh" stroke="#f59e0b" strokeWidth={2} fill="url(#luceGrad)" dot={false} activeDot={{ r: 4, fill: "#f59e0b" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gas Chart */}
        <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <p style={{ color: "#38bdf8", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, margin: "0 0 4px", textTransform: "uppercase" }}>Gas</p>
              <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0 }}>Consumi ultimi 16 mesi</p>
            </div>
            <Flame size={18} color="#38bdf844" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={gasData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis dataKey="mese" tick={{ fill: "#4b5563", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltipGas />} />
              <Bar dataKey="smc" fill="#38bdf8" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Bills */}
      <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0 }}>Ultime bollette</p>
          <button style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            Vedi tutte <ChevronRight size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {BOLLETTE.map(b => (
            <div key={b.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#0a0a0a", borderRadius: 10, padding: "12px 16px",
              border: "1px solid #1a1a1a"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  background: b.tipo === "LUCE" ? "#f59e0b22" : "#38bdf822",
                  borderRadius: 8, padding: 8
                }}>
                  {b.tipo === "LUCE" ? <Zap size={14} color="#f59e0b" /> : <Flame size={14} color="#38bdf8" />}
                </div>
                <div>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    Bolletta {b.tipo} — {b.periodo}
                  </p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>Emessa il {b.data}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>
                  {b.importo.toFixed(2)} €
                </p>
                <span style={{
                  background: "#16a34a22", color: "#22c55e", fontSize: 10,
                  borderRadius: 20, padding: "2px 8px", fontWeight: 600
                }}>pagata</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadScreen({ onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState([]);
  const fileRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length) {
      const newFiles = files.map(f => ({ name: f.name, size: (f.size / 1024).toFixed(0) + " KB", status: "analisi..." }));
      setUploaded(prev => [...prev, ...newFiles]);
      setTimeout(() => {
        setUploaded(prev => prev.map(f => ({ ...f, status: "estratto" })));
      }, 1800);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>Importa</p>
        <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "4px 0 0", fontFamily: "'Sora', sans-serif" }}>Carica bollette</h2>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#f59e0b" : "#2a2a2a"}`,
          borderRadius: 20, padding: 48, textAlign: "center", cursor: "pointer",
          background: dragging ? "#f59e0b08" : "#0a0a0a",
          transition: "all 0.2s"
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files);
            const newFiles = files.map(f => ({ name: f.name, size: (f.size / 1024).toFixed(0) + " KB", status: "analisi..." }));
            setUploaded(prev => [...prev, ...newFiles]);
            setTimeout(() => setUploaded(prev => prev.map(f => ({ ...f, status: "estratto" }))), 1800);
          }}
        />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ background: "#f59e0b15", borderRadius: "50%", padding: 20 }}>
            <Upload size={32} color="#f59e0b" />
          </div>
        </div>
        <p style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
          Trascina qui le tue bollette PDF
        </p>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
          Supporta A2A, Enel, Eni, Edison, Hera, Sorgenia, Pulsee e altri
        </p>
      </div>

      {/* Uploaded Files */}
      {uploaded.length > 0 && (
        <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: 20 }}>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>File caricati</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {uploaded.map((f, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#0a0a0a", borderRadius: 10, padding: "12px 16px", border: "1px solid #1a1a1a"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={16} color="#f59e0b" />
                  <div>
                    <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>{f.name}</p>
                    <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>{f.size}</p>
                  </div>
                </div>
                <span style={{
                  background: f.status === "estratto" ? "#16a34a22" : "#f59e0b22",
                  color: f.status === "estratto" ? "#22c55e" : "#f59e0b",
                  fontSize: 11, borderRadius: 20, padding: "3px 10px", fontWeight: 600
                }}>
                  {f.status}
                </span>
              </div>
            ))}
          </div>

          {uploaded.some(f => f.status === "estratto") && (
            <div style={{ marginTop: 16, background: "#0d1f0d", border: "1px solid #22c55e33", borderRadius: 12, padding: 16 }}>
              <p style={{ color: "#22c55e", fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>✓ Dati estratti con successo</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["POD (Luce)", "IT012E00367605"],
                  ["PDR (Gas)", "05260200451415"],
                  ["Prezzo Luce", "0,12636 €/kWh"],
                  ["Prezzo Gas", "0,51339 €/Smc"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#6b7280", fontSize: 12 }}>{k}</span>
                    <span style={{ color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Supported providers */}
      <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: 20 }}>
        <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, margin: "0 0 14px", textTransform: "uppercase" }}>Fornitori supportati</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["A2A", "Enel", "Eni/Plenitude", "Edison", "Hera", "Engie", "E.ON", "Sorgenia", "Iren", "Acea", "Pulsee"].map(p => (
            <span key={p} style={{
              background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20,
              padding: "5px 12px", color: "#9ca3af", fontSize: 12
            }}>{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MercatoScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>Prezzi</p>
        <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "4px 0 0", fontFamily: "'Sora', sans-serif" }}>Mercato energetico</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[
          { label: "PUN – Prezzo Unico Nazionale", value: "0,152", unit: "€/kWh", sub: "Luce all'ingrosso · Marzo 2026", color: "#f59e0b", trend: "+8,5% vs Feb", trendUp: true },
          { label: "PSV – Punto di Scambio Virtuale", value: "0,567", unit: "€/Smc", sub: "Gas all'ingrosso · Marzo 2026", color: "#38bdf8", trend: "+12% vs Feb", trendUp: true },
        ].map((m, i) => (
          <div key={i} style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: 24 }}>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 12px", letterSpacing: 1 }}>{m.label}</p>
            <p style={{ color: m.color, fontSize: 36, fontWeight: 800, margin: "0 0 4px", fontFamily: "'Sora', sans-serif" }}>
              {m.value} <span style={{ fontSize: 14, color: "#6b7280" }}>{m.unit}</span>
            </p>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 12px" }}>{m.sub}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={14} color="#ef4444" />
              <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>{m.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: 24 }}>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 20px" }}>La tua tariffa vs mercato</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            {
              tipo: "LUCE", icon: <Zap size={16} color="#f59e0b" />, color: "#f59e0b",
              tuo: "0,12636", mercato: "0,17200", risparmio: "-0,04564",
              status: "CONVENIENTE", cons: 5268, saving: 240
            },
            {
              tipo: "GAS", icon: <Flame size={16} color="#38bdf8" />, color: "#38bdf8",
              tuo: "0,51339", mercato: "0,66700", risparmio: "-0,15361",
              status: "CONVENIENTE", cons: 817, saving: 125
            },
          ].map(r => (
            <div key={r.tipo} style={{
              background: "#0a0a0a", borderRadius: 12, padding: 16,
              border: "1px solid #22c55e22"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ background: r.color + "22", borderRadius: 8, padding: 6 }}>{r.icon}</div>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{r.tipo}</span>
                </div>
                <span style={{ background: "#16a34a22", color: "#22c55e", fontSize: 11, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>
                  {r.status}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  ["La tua tariffa", r.tuo, "#fff"],
                  ["Prezzo mercato", r.mercato, "#6b7280"],
                  ["Differenza", r.risparmio, "#22c55e"],
                ].map(([l, v, c]) => (
                  <div key={l}>
                    <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 4px" }}>{l}</p>
                    <p style={{ color: c, fontSize: 16, fontWeight: 800, margin: 0, fontFamily: "monospace" }}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1a1a1a" }}>
                <p style={{ color: "#22c55e", fontSize: 12, margin: 0, fontWeight: 600 }}>
                  ✓ Stai risparmiando circa <strong>{r.saving}€/anno</strong> rispetto a una tariffa indicizzata al mercato
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const navItems = [
    { id: "dashboard", icon: <Home size={18} />, label: "Dashboard" },
    { id: "upload", icon: <Upload size={18} />, label: "Bollette" },
    { id: "mercato", icon: <BarChart2 size={18} />, label: "Mercato" },
    { id: "settings", icon: <Settings size={18} />, label: "Impostazioni" },
  ];

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: "#080808",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: "#fff"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
      `}</style>

      {/* Sidebar */}
      <div style={{
        width: 220, background: "#0c0c0c", borderRight: "1px solid #1a1a1a",
        display: "flex", flexDirection: "column", padding: "24px 0", position: "sticky", top: 0, height: "100vh"
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 28px", borderBottom: "1px solid #1a1a1a", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              borderRadius: 10, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <p style={{ color: "#fff", fontSize: 15, fontWeight: 800, margin: 0, fontFamily: "'Sora', sans-serif" }}>EnergyIQ</p>
              <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>Monitor bollette</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 12px" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer",
              marginBottom: 4, transition: "all 0.15s",
              background: activeTab === item.id ? "#f59e0b18" : "transparent",
              color: activeTab === item.id ? "#f59e0b" : "#6b7280",
            }}>
              {item.icon}
              <span style={{ fontSize: 14, fontWeight: activeTab === item.id ? 600 : 400 }}>{item.label}</span>
              {activeTab === item.id && (
                <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "#f59e0b" }} />
              )}
            </button>
          ))}
        </nav>

        {/* User Badge */}
        <div style={{ padding: "16px 12px", borderTop: "1px solid #1a1a1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff"
            }}>MV</div>
            <div>
              <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, margin: 0 }}>Marco Vinci</p>
              <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>Milano, MI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "32px 32px", overflowY: "auto", maxWidth: 960 }}>
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "upload" && <UploadScreen />}
        {activeTab === "mercato" && <MercatoScreen />}
        {activeTab === "settings" && (
          <div style={{ color: "#6b7280", textAlign: "center", paddingTop: 80 }}>
            <Settings size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontSize: 16 }}>Impostazioni — in arrivo</p>
          </div>
        )}
      </div>
    </div>
  );
}