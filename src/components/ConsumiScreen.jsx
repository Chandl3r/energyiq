import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import { Upload, X, CheckCircle, AlertCircle, Zap, Flame, Activity } from "lucide-react";

// ─── Palette (identica ad AppShell) ──────────────────────────────────────────
const C = {
  bg: "#080808", surface: "#111111", border: "#1f1f1f", border2: "#2a2a2a",
  text: "#f5f5f5", textMid: "#9ca3af", textDim: "#4b5563",
  amber: "#f59e0b", amberDim: "#1c1503", amberMid: "#78350f",
  sky:   "#38bdf8", skyDim:   "#001f2e", skyMid:   "#0c4a6e",
  green: "#22c55e",
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const MESI = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function fmtMese(annomese) {
  const s = String(annomese);
  return `${MESI[parseInt(s.slice(4)) - 1]} ${s.slice(2,4)}`;
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseLuceCSV(text) {
  const rows = text.trim().split("\n");
  const header = rows[0].split(";");
  const iData = header.findIndex(h => h.trim() === "data_lettura");
  const iAnno = header.findIndex(h => h.trim() === "annomese_riferimento");
  const iEa1  = header.findIndex(h => h.trim() === "ea1");
  const iPod  = header.findIndex(h => h.trim() === "pod");

  if (iData < 0 || iAnno < 0 || iEa1 < 0) return { error: "Colonne non trovate — verifica che sia il file ARERA Luce corretto." };

  const byDate = new Map();
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(";");
    if (cols.length < iEa1 + 96) continue;
    const dataTxt  = cols[iData]?.trim();
    const annoMese = parseInt(cols[iAnno]?.trim());
    const pod      = cols[iPod]?.trim() || "";
    if (!dataTxt || !annoMese) continue;

    // DD/MM/YYYY → YYYY-MM-DD
    const parts = dataTxt.split("/");
    if (parts.length !== 3) continue;
    const [dd, mm, yyyy] = parts;
    const dataISO = `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;

    const ea = [];
    let tot = 0;
    for (let k = 0; k < 96; k++) {
      const v = parseFloat(cols[iEa1 + k]) || 0;
      ea.push(v);
      tot += v;
    }
    // Deduplicazione: per la stessa data teniamo l'ultima riga
    byDate.set(dataISO, {
      pod,
      data_lettura: dataISO,
      annomese_riferimento: annoMese,
      totale_kwh: Math.round(tot * 1000) / 1000,
      valori_ea: ea,
    });
  }
  return { rows: Array.from(byDate.values()) };
}

function parseGasCSV(text) {
  const rows = text.trim().split("\n");
  // PDR;ANNOMESE_RIFERIMENTO;DATA LETTURA;DATA RICEZIONE;FLUSSO;MOTIVAZIONE;LETTURA
  const byData = new Map();
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(";");
    if (cols.length < 7) continue;
    const pdr        = cols[0]?.trim();
    const annoMese   = parseInt(cols[1]?.trim());
    const dataLettura= cols[2]?.trim();  // YYYY-MM-DD
    const letturaTxt = cols[6]?.trim().replace(/^0+/, "") || "0";
    const lettura    = parseFloat(letturaTxt) || 0;
    if (!pdr || !annoMese || !dataLettura || lettura === 0) continue;
    // Deduplicazione per data esatta (chiave = pdr+data)
    const key = `${pdr}|${dataLettura}`;
    const existing = byData.get(key);
    if (!existing || lettura > existing.lettura_smc) {
      byData.set(key, { pdr, annomese_riferimento: annoMese, data_lettura: dataLettura, lettura_smc: lettura });
    }
  }
  return { rows: Array.from(byData.values()).sort((a,b) => a.data_lettura.localeCompare(b.data_lettura)) };
}

// ─── Aggregazioni per i grafici ───────────────────────────────────────────────

function aggregaLuceMensile(misure) {
  const map = new Map();
  for (const m of misure) {
    const k = m.annomese_riferimento;
    map.set(k, (map.get(k) || 0) + m.totale_kwh);
  }
  return Array.from(map.entries())
    .sort(([a],[b]) => a - b)
    .map(([k, v]) => ({ mese: fmtMese(k), kwh: Math.round(v) }));
}

function aggregaGasMensile(letture) {
  // ordinate per data; per ogni mese prendiamo la lettura più alta (ultima del mese)
  const byMese = new Map();
  for (const l of letture) {
    const k = l.annomese_riferimento;
    if (!byMese.has(k) || l.lettura_smc > byMese.get(k).lettura_smc) byMese.set(k, l);
  }
  const sorted = Array.from(byMese.values()).sort((a,b) => a.annomese_riferimento - b.annomese_riferimento);
  const result = [];
  for (let i = 1; i < sorted.length; i++) {
    const consumo = sorted[i].lettura_smc - sorted[i-1].lettura_smc;
    if (consumo >= 0 && consumo < 400) {
      result.push({ mese: fmtMese(sorted[i].annomese_riferimento), smc: Math.round(consumo * 10) / 10 });
    }
  }
  return result;
}

function calcolaCurvaDiCarico(misure) {
  if (misure.length === 0) return [];
  const sums   = new Array(96).fill(0);
  const counts = new Array(96).fill(0);
  for (const m of misure) {
    const ea = m.valori_ea;
    if (!Array.isArray(ea) || ea.length < 96) continue;
    for (let k = 0; k < 96; k++) {
      const v = parseFloat(ea[k]) || 0;
      if (v > 0) { sums[k] += v; counts[k]++; }
    }
  }
  // Raggruppa in 24 ore (4 slot ciascuna), media in W (kWh/0.25h → *4 → kW → *1000 → W)
  return Array.from({ length: 24 }, (_, h) => {
    let wh = 0;
    for (let s = 0; s < 4; s++) {
      const idx = h * 4 + s;
      wh += counts[idx] > 0 ? sums[idx] / counts[idx] : 0;
    }
    return {
      ora: `${h.toString().padStart(2,"0")}:00`,
      watt: Math.round((wh / 4) * 1000 * 10) / 10,  // W medi nell'ora
    };
  });
}

// ─── Sub-componenti grafici ───────────────────────────────────────────────────

const CustomBarTooltip = ({ active, payload, label, unit, color }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface, border:`1px solid ${color}40`, borderRadius:10, padding:"8px 12px" }}>
      <p style={{ color:C.textDim, fontSize:10, marginBottom:3 }}>{label}</p>
      <p style={{ color, fontSize:14, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
        {payload[0].value} {unit}
      </p>
    </div>
  );
};

const CustomLineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.amber}40`, borderRadius:10, padding:"8px 12px" }}>
      <p style={{ color:C.textDim, fontSize:10, marginBottom:3 }}>{label}</p>
      <p style={{ color:C.amber, fontSize:14, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
        {payload[0].value} W
      </p>
    </div>
  );
};

function BarCard({ title, subtitle, icon, color, dim, borderColor, data, dataKey, unit }) {
  const max = Math.max(...data.map(d => d[dataKey]), 1);
  return (
    <div style={{ background:C.surface, border:`1px solid ${borderColor}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 8px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <p style={{ color, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>{icon} {title}</p>
          <p style={{ color:C.textDim, fontSize:11, margin:0 }}>{subtitle}</p>
        </div>
        <span style={{ color:C.textDim, fontSize:11, marginTop:4 }}>{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top:8, right:16, left:16, bottom:4 }} barCategoryGap="30%">
          <XAxis dataKey="mese" axisLine={false} tickLine={false} tick={{ fill:C.textDim, fontSize:9 }} interval={0} />
          <YAxis hide domain={[0, max * 1.15]} />
          <Tooltip content={<CustomBarTooltip unit={unit} color={color} />} cursor={{ fill:`${color}10` }} />
          <Bar dataKey={dataKey} radius={[6,6,2,2]} isAnimationActive={false}>
            {data.map((entry, i) => {
              const pct = entry[dataKey] / max;
              const isMax = entry[dataKey] === max;
              return <Cell key={i} fill={isMax ? color : `${color}${Math.round(pct * 180).toString(16).padStart(2,"0")}`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CurvaCard({ data }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.amberMid}`, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"16px 18px 8px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <p style={{ color:C.amber, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 3px", textTransform:"uppercase" }}>⚡ Curva di Carico</p>
          <p style={{ color:C.textDim, fontSize:11, margin:0 }}>Consumo medio per ora del giorno</p>
        </div>
        <span style={{ color:C.textDim, fontSize:11, marginTop:4 }}>W medi</span>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data} margin={{ top:8, right:16, left:16, bottom:4 }}>
          <XAxis
            dataKey="ora"
            axisLine={false} tickLine={false}
            tick={{ fill:C.textDim, fontSize:8 }}
            interval={5}
          />
          <YAxis hide />
          <Tooltip content={<CustomLineTooltip />} />
          <Line
            type="natural" dataKey="watt" stroke={C.amber} strokeWidth={2}
            dot={false} activeDot={{ r:4, fill:C.amber, stroke:"white", strokeWidth:1.5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ user, onClose, onDone }) {
  const [luceFile, setLuceFile]   = useState(null);
  const [gasFile,  setGasFile]    = useState(null);
  const [lucePreview, setLucePreview] = useState(null); // { count, error }
  const [gasPreview,  setGasPreview]  = useState(null);
  const [luceParsed, setLuceParsed]   = useState(null); // rows[]
  const [gasParsed,  setGasParsed]    = useState(null);
  const [saving, setSaving]   = useState(false);
  const [done,   setDone]     = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const luceRef = useRef(); const gasRef = useRef();

  function handleLuceFile(file) {
    if (!file) return;
    setLuceFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { rows, error } = parseLuceCSV(e.target.result);
      if (error) { setLucePreview({ error }); setLuceParsed(null); return; }
      // Raggruppa mesi per preview
      const mesi = new Set(rows.map(r => r.annomese_riferimento));
      setLucePreview({ count: rows.length, mesi: mesi.size });
      setLuceParsed(rows);
    };
    reader.readAsText(file);
  }

  function handleGasFile(file) {
    if (!file) return;
    setGasFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { rows, error } = parseGasCSV(e.target.result);
      if (error) { setGasPreview({ error }); setGasParsed(null); return; }
      setGasPreview({ count: rows.length });
      setGasParsed(rows);
    };
    reader.readAsText(file);
  }

  async function handleSave() {
    setSaving(true); setSaveErr(null);
    try {
      // Salva luce in batch da 20 (i record hanno JSONB grande)
      if (luceParsed?.length) {
        const toInsert = luceParsed.map(r => ({ ...r, utente_id: user.id }));
        for (let i = 0; i < toInsert.length; i += 20) {
          const chunk = toInsert.slice(i, i + 20);
          const { error } = await supabase.from("misure_quartorarie")
            .upsert(chunk, { onConflict: "utente_id,pod,data_lettura" });
          if (error) throw new Error(`Luce batch ${i}: ${error.message}`);
        }
      }
      // Salva gas
      if (gasParsed?.length) {
        const toInsert = gasParsed.map(r => ({ ...r, utente_id: user.id }));
        const { error } = await supabase.from("letture_gas_arera")
          .upsert(toInsert, { onConflict: "utente_id,pdr,data_lettura" });
        if (error) throw new Error(`Gas: ${error.message}`);
      }
      setDone(true);
      setTimeout(onDone, 1200);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canSave = !saving && !done && (luceParsed?.length || gasParsed?.length);

  return (
    <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={(e) => { if (e.target===e.currentTarget && !saving) onClose(); }}>
      <div style={{ background:C.bg, border:`1px solid ${C.border2}`, borderRadius:"24px 24px 0 0", padding:"24px 20px 44px", width:"100%", maxWidth:430 }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <p style={{ color:C.textDim, fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", marginBottom:3 }}>ARERA</p>
            <h2 style={{ color:C.text, fontSize:20, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>Importa Misure</h2>
          </div>
          {!saving && <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><X size={20} color={C.textDim} /></button>}
        </div>

        {/* File picker Luce */}
        <FilePicker
          label="⚡ CSV Luce (misure quartorarie)"
          color={C.amber} dim={C.amberDim} border={C.amberMid}
          file={luceFile}
          preview={lucePreview}
          previewText={lucePreview?.error ? lucePreview.error : lucePreview ? `${lucePreview.count} giorni · ${lucePreview.mesi} mesi` : null}
          inputRef={luceRef}
          onChange={(e) => handleLuceFile(e.target.files[0])}
          accept=".csv"
        />

        <div style={{ height:10 }} />

        {/* File picker Gas */}
        <FilePicker
          label="🔥 CSV Gas (letture cumulative)"
          color={C.sky} dim={C.skyDim} border={C.skyMid}
          file={gasFile}
          preview={gasPreview}
          previewText={gasPreview?.error ? gasPreview.error : gasPreview ? `${gasPreview.count} letture trovate` : null}
          inputRef={gasRef}
          onChange={(e) => handleGasFile(e.target.files[0])}
          accept=".csv"
        />

        {saveErr && (
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1a0505", border:"1px solid #7f1d1d", borderRadius:12, padding:"10px 14px", marginTop:14 }}>
            <AlertCircle size={14} color="#ef4444" />
            <span style={{ color:"#ef4444", fontSize:12 }}>{saveErr}</span>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            width:"100%", marginTop:20, padding:"16px",
            background: done ? "#052e1a" : canSave ? C.amber : C.surface,
            border: `1px solid ${done ? C.green : canSave ? C.amber : C.border2}`,
            borderRadius:16, cursor: canSave ? "pointer" : "default",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}>
          {done
            ? <><CheckCircle size={16} color={C.green} /><span style={{ color:C.green, fontSize:15, fontWeight:700 }}>Salvato!</span></>
            : saving
              ? <span style={{ color:C.textMid, fontSize:15 }}>Salvataggio in corso…</span>
              : <span style={{ color: canSave ? "black" : C.textDim, fontSize:15, fontWeight:700 }}>
                  {!luceParsed && !gasParsed ? "Seleziona almeno un file" : "Salva su Supabase"}
                </span>
          }
        </button>
      </div>
    </div>
  );
}

function FilePicker({ label, color, dim, border, file, previewText, inputRef, onChange, accept }) {
  const hasError = previewText && file && !previewText.includes("·") && !previewText.includes("letture");
  return (
    <div style={{ background: dim, border:`1px solid ${border}`, borderRadius:16, padding:"14px 16px" }}>
      <p style={{ color, fontSize:11, fontWeight:700, marginBottom:10 }}>{label}</p>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button
          onClick={() => inputRef.current?.click()}
          style={{ background:C.surface, border:`1px solid ${border}`, borderRadius:10, padding:"8px 14px", cursor:"pointer", flexShrink:0 }}>
          <span style={{ color, fontSize:12, fontWeight:600 }}>{file ? "Cambia" : "Scegli file"}</span>
        </button>
        <span style={{ color: hasError ? "#ef4444" : previewText ? color : C.textDim, fontSize:11, flexGrow:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {previewText || (file ? file.name : "Nessun file selezionato")}
        </span>
        <input ref={inputRef} type="file" accept={accept} onChange={onChange} style={{ display:"none" }} />
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onImport }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 20px", gap:16, textAlign:"center" }}>
      <div style={{ background:C.amberDim, borderRadius:20, padding:20 }}>
        <Activity size={32} color={C.amber} />
      </div>
      <div>
        <p style={{ color:C.text, fontSize:17, fontWeight:700, marginBottom:6 }}>Nessun dato ARERA</p>
        <p style={{ color:C.textDim, fontSize:13, lineHeight:1.6, maxWidth:260 }}>
          Importa i CSV scaricati dal portale ARERA per vedere la tua curva di carico e i consumi reali.
        </p>
      </div>
      <button onClick={onImport}
        style={{ background:C.amber, border:"none", borderRadius:14, padding:"14px 28px", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
        <Upload size={16} color="black" />
        <span style={{ color:"black", fontSize:14, fontWeight:700 }}>Importa CSV ARERA</span>
      </button>
      <p style={{ color:C.textDim, fontSize:11 }}>
        Portale ARERA → I tuoi dati → Scarica misure
      </p>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ConsumiScreen({ user }) {
  const [misureLuce, setMisureLuce] = useState([]);
  const [lettureGas, setLettureGas] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { loadData(); }, [user?.id]);

  async function loadData() {
    setLoading(true);
    const [{ data: ml }, { data: lg }] = await Promise.all([
      supabase.from("misure_quartorarie").select("data_lettura,annomese_riferimento,totale_kwh,valori_ea").eq("utente_id", user.id).order("data_lettura"),
      supabase.from("letture_gas_arera").select("annomese_riferimento,data_lettura,lettura_smc").eq("utente_id", user.id).order("data_lettura"),
    ]);
    setMisureLuce(ml || []);
    setLettureGas(lg || []);
    setLoading(false);
  }

  const hasData = misureLuce.length > 0 || lettureGas.length > 0;

  const luceBar = aggregaLuceMensile(misureLuce);
  const gasBar  = aggregaGasMensile(lettureGas);
  const curva   = calcolaCurvaDiCarico(misureLuce);

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <p style={{ color:C.textDim, fontSize:11, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>ARERA</p>
          <h1 style={{ color:C.text, fontSize:28, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>Consumi</h1>
        </div>
        {hasData && (
          <button onClick={() => setShowImport(true)}
            style={{ background:C.amberDim, border:`1px solid ${C.amberMid}`, borderRadius:12, padding:"8px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
            <Upload size={14} color={C.amber} />
            <span style={{ color:C.amber, fontSize:12, fontWeight:700 }}>Aggiorna</span>
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color:C.textDim, textAlign:"center", padding:40 }}>Caricamento…</p>
      ) : !hasData ? (
        <EmptyState onImport={() => setShowImport(true)} />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {luceBar.length > 0 && (
            <BarCard
              title="Luce mensile"
              subtitle={`${misureLuce.length} giorni di dati ARERA`}
              icon="⚡"
              color={C.amber}
              dim={C.amberDim}
              borderColor={C.amberMid}
              data={luceBar}
              dataKey="kwh"
              unit="kWh"
            />
          )}
          {curva.length > 0 && <CurvaCard data={curva} />}
          {gasBar.length > 0 && (
            <BarCard
              title="Gas mensile"
              subtitle={`${lettureGas.length} letture ARERA`}
              icon="🔥"
              color={C.sky}
              dim={C.skyDim}
              borderColor={C.skyMid}
              data={gasBar}
              dataKey="smc"
              unit="Smc"
            />
          )}
        </div>
      )}

      {showImport && (
        <ImportModal
          user={user}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); loadData(); }}
        />
      )}
    </div>
  );
}
