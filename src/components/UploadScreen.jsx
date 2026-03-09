// src/components/UploadScreen.jsx
import { useState, useRef } from "react";
import { Camera, FileText, CheckCircle, AlertCircle, Loader2, Save, RotateCcw } from "lucide-react";
import { supabase } from "../lib/supabase";

const C = {
  bg:"#080808", surface:"#111111", surface2:"#181818",
  border:"#1e1e1e", border2:"#252525",
  amber:"#f59e0b", amberDim:"#f59e0b20", amberMid:"#f59e0b40",
  sky:"#38bdf8", skyDim:"#38bdf820",
  green:"#22c55e", greenDim:"#22c55e18",
  red:"#ef4444", redDim:"#ef444415",
  text:"#ffffff", textMid:"#9ca3af", textDim:"#4b5563",
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadScreen({ user, onBollettaSaved }) {
  const [fase,       setFase]       = useState("idle");
  const [errore,     setErrore]     = useState(null);
  const [datiEstrat, setDatiEstrat] = useState(null);
  const [fileName,   setFileName]   = useState(null);
  const fileRef = useRef();
  const imgRef  = useRef();

  const reset = () => {
    setFase("idle"); setErrore(null); setDatiEstrat(null); setFileName(null);
  };

  const parseFile = async (file) => {
    setFileName(file.name);
    setFase("parsing");
    setErrore(null);
    try {
      const b64  = await fileToBase64(file);
      const mime = file.type || "application/pdf";

      const res  = await fetch("/api/parse-bill", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mimeType: mime, data: b64 }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? `HTTP ${res.status}`);

      setDatiEstrat(json.data);
      setFase("review");
    } catch (err) {
      setErrore(err.message);
      setFase("error");
    }
  };

  const salva = async () => {
    if (!datiEstrat || !user) return;
    setFase("saving");
    setErrore(null);

    try {
      const d = datiEstrat;

      // Fallback: se pod_pdr è null usa un placeholder temporaneo
      const podPdr = d.pod_pdr ?? `SCONOSCIUTO-${Date.now()}`;

      // Cerca fornitura esistente con questo POD/PDR
      const { data: esistente, error: errQ } = await supabase
        .from("forniture").select("id")
        .eq("utente_id", user.id)
        .eq("pod_pdr", podPdr)
        .maybeSingle();

      if (errQ) throw new Error(`Errore ricerca fornitura: ${errQ.message}`);

      let fornituraId;
      if (esistente) {
        fornituraId = esistente.id;
      } else {
        const { data: nuova, error: errF } = await supabase
          .from("forniture").insert({
            utente_id:             user.id,
            tipo_utenza:           d.tipo_utenza ?? "LUCE",
            pod_pdr:               podPdr,
            fornitore:             d.fornitore ?? "Sconosciuto",
            nome_offerta:          d.nome_offerta,
            data_scadenza_offerta: d.data_scadenza_offerta,
          }).select("id").single();

        if (errF) throw new Error(`Errore creazione fornitura: ${errF.message}`);
        fornituraId = nuova.id;

        if (d.prezzo_materia_prima) {
          const { error: errT } = await supabase.from("tariffe").insert({
            fornitura_id:         fornituraId,
            tipo_prezzo:          d.tipo_prezzo ?? "FISSO",
            prezzo_materia_prima: d.prezzo_materia_prima,
            data_inizio:          d.periodo_inizio ?? new Date().toISOString().slice(0,10),
            data_fine:            d.data_scadenza_offerta,
          });
          if (errT) console.warn("Tariffa non salvata:", errT.message);
        }
      }

      const { error: errB } = await supabase.from("bollette").insert({
        fornitura_id:      fornituraId,
        data_emissione:    d.data_emissione,
        periodo_inizio:    d.periodo_inizio,
        periodo_fine:      d.periodo_fine,
        consumo_fatturato: d.consumo_fatturato,
        totale_pagare:     d.totale_pagare,
        stato:             "pagata",
        dati_estratti:     d,
      });

      if (errB) throw new Error(`Errore salvataggio bolletta: ${errB.message}`);

      setFase("saved");
      onBollettaSaved?.();

    } catch (err) {
      console.error("Errore salvataggio:", err.message);
      setErrore(err.message);
      setFase("error");
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:8 }}>
      <div>
        <p style={{ color:C.textDim, fontSize:12, margin:"0 0 4px", letterSpacing:2, textTransform:"uppercase" }}>Importa</p>
        <h2 style={{ color:C.text, fontSize:24, fontWeight:800, margin:0, fontFamily:"'Sora',sans-serif" }}>Carica bolletta</h2>
      </div>

      {fase === "idle" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <button onClick={() => fileRef.current?.click()}
              style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:18, padding:"20px 16px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <div style={{ background:C.amberDim, borderRadius:12, padding:12 }}><FileText size={24} color={C.amber} /></div>
              <div style={{ textAlign:"center" }}>
                <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 3px" }}>Carica PDF</p>
                <p style={{ color:C.textDim, fontSize:11, margin:0 }}>Dal tuo dispositivo</p>
              </div>
            </button>
            <button onClick={() => imgRef.current?.click()}
              style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:18, padding:"20px 16px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <div style={{ background:C.skyDim, borderRadius:12, padding:12 }}><Camera size={24} color={C.sky} /></div>
              <div style={{ textAlign:"center" }}>
                <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 3px" }}>Fotografa</p>
                <p style={{ color:C.textDim, fontSize:11, margin:0, lineHeight:1.4 }}>Scatta o carica<br/>Foto/Screenshot</p>
              </div>
            </button>
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
            <p style={{ color:C.textMid, fontSize:12, fontWeight:600, margin:"0 0 10px" }}>💡 Come funziona</p>
            {["Carica il PDF oppure fotografa la bolletta","L'AI estrae automaticamente prezzi, consumi e POD/PDR","Controlla i dati e salvali con un tap"].map((t,i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:i<2?10:0 }}>
                <div style={{ background:C.amberDim, borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:C.amber, fontSize:10, fontWeight:700 }}>{i+1}</span>
                </div>
                <p style={{ color:C.textMid, fontSize:12, margin:0, lineHeight:1.5 }}>{t}</p>
              </div>
            ))}
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
            <p style={{ color:C.textDim, fontSize:11, fontWeight:700, letterSpacing:1.5, margin:"0 0 12px", textTransform:"uppercase" }}>Fornitori supportati</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
              {["A2A","Enel","Eni","Edison","Hera","Engie","E.ON","Sorgenia","Iren","Acea","Pulsee"].map(p => (
                <span key={p} style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:20, padding:"5px 12px", color:C.textMid, fontSize:11 }}>{p}</span>
              ))}
            </div>
          </div>
        </>
      )}

      {fase === "parsing" && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:32, display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
          <Loader2 size={36} color={C.amber} style={{ animation:"spin 1s linear infinite" }} />
          <div style={{ textAlign:"center" }}>
            <p style={{ color:C.text, fontSize:15, fontWeight:700, margin:"0 0 6px" }}>Analisi AI in corso...</p>
            <p style={{ color:C.textDim, fontSize:12, margin:0 }}>{fileName}</p>
          </div>
          <p style={{ color:C.textDim, fontSize:11, textAlign:"center", lineHeight:1.6 }}>
            Lettura bolletta in corso,<br/>può richiedere 10–20 secondi
          </p>
        </div>
      )}

      {fase === "review" && datiEstrat && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#0d1a0d", border:`1px solid ${C.green}33`, borderRadius:20, padding:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <CheckCircle size={18} color={C.green} />
              <p style={{ color:C.green, fontSize:13, fontWeight:700, margin:0 }}>Dati estratti</p>
            </div>
            <div style={{ marginBottom:14 }}>
              <span style={{
                background: datiEstrat.tipo_utenza === "LUCE" ? C.amberDim : C.skyDim,
                color:      datiEstrat.tipo_utenza === "LUCE" ? C.amber    : C.sky,
                fontSize:11, fontWeight:700, borderRadius:20, padding:"4px 12px",
                letterSpacing:1, textTransform:"uppercase",
              }}>
                {datiEstrat.tipo_utenza === "LUCE" ? "⚡ Luce" : "🔥 Gas"}
              </span>
            </div>
            {[
              ["Fornitore",        datiEstrat.fornitore],
              ["Offerta",          datiEstrat.nome_offerta],
              [datiEstrat.tipo_utenza==="LUCE"?"POD":"PDR", datiEstrat.pod_pdr],
              ["Periodo",          datiEstrat.periodo_inizio && datiEstrat.periodo_fine
                                   ? `${fmt(datiEstrat.periodo_inizio)} → ${fmt(datiEstrat.periodo_fine)}` : null],
              ["Consumo",          datiEstrat.consumo_fatturato != null
                                   ? `${datiEstrat.consumo_fatturato} ${datiEstrat.unita_misura ?? ""}` : null],
              ["Tariffa",          datiEstrat.prezzo_materia_prima != null
                                   ? `${datiEstrat.prezzo_materia_prima} €/${datiEstrat.unita_misura ?? "kWh"}` : null],
              ["Totale",           datiEstrat.totale_pagare != null ? `${datiEstrat.totale_pagare} €` : null],
              ["Scadenza offerta", datiEstrat.data_scadenza_offerta ? fmt(datiEstrat.data_scadenza_offerta) : null],
            ].filter(([,v]) => v != null).map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:12 }}>
                <span style={{ color:C.textDim, fontSize:12, flexShrink:0 }}>{k}</span>
                <span style={{ color:C.text, fontSize:12, fontWeight:600, textAlign:"right",
                  fontFamily: k==="POD"||k==="PDR" ? "monospace":"inherit" }}>{v}</span>
              </div>
            ))}
            {datiEstrat.note && (
              <p style={{ color:C.textDim, fontSize:11, marginTop:8, padding:"10px 12px", background:C.surface, borderRadius:10, lineHeight:1.5 }}>
                📝 {datiEstrat.note}
              </p>
            )}
          </div>
          <button onClick={salva} style={{ width:"100%", padding:"16px", borderRadius:18, background:C.green, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <Save size={18} color="#fff" />
            <span style={{ color:"#fff", fontSize:15, fontWeight:700 }}>Salva bolletta</span>
          </button>
          <button onClick={reset} style={{ width:"100%", padding:"14px", borderRadius:18, background:C.surface, border:`1px solid ${C.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <RotateCcw size={16} color={C.textDim} />
            <span style={{ color:C.textDim, fontSize:14 }}>Carica un'altra bolletta</span>
          </button>
        </div>
      )}

      {fase === "saving" && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:32, display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
          <Loader2 size={36} color={C.green} style={{ animation:"spin 1s linear infinite" }} />
          <p style={{ color:C.text, fontSize:15, fontWeight:700, margin:0 }}>Salvataggio in corso...</p>
        </div>
      )}

      {fase === "saved" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#0d1a0d", border:`1px solid ${C.green}33`, borderRadius:20, padding:28, display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
            <CheckCircle size={40} color={C.green} />
            <div style={{ textAlign:"center" }}>
              <p style={{ color:C.green, fontSize:16, fontWeight:700, margin:"0 0 6px" }}>Bolletta salvata!</p>
              <p style={{ color:C.textDim, fontSize:12, margin:0, lineHeight:1.6 }}>
                I dati sono stati salvati nel tuo profilo.<br/>Torna alla Home per vedere i grafici aggiornati.
              </p>
            </div>
          </div>
          <button onClick={reset} style={{ width:"100%", padding:"14px", borderRadius:18, background:C.surface, border:`1px solid ${C.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <RotateCcw size={16} color={C.textDim} />
            <span style={{ color:C.textDim, fontSize:14 }}>Carica un'altra bolletta</span>
          </button>
        </div>
      )}

      {fase === "error" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:C.redDim, border:`1px solid ${C.red}33`, borderRadius:20, padding:24, display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
            <AlertCircle size={36} color={C.red} />
            <div style={{ textAlign:"center" }}>
              <p style={{ color:C.red, fontSize:14, fontWeight:700, margin:"0 0 8px" }}>Errore</p>
              <p style={{ color:C.textDim, fontSize:12, margin:0, lineHeight:1.6 }}>{errore}</p>
            </div>
          </div>
          <button onClick={reset} style={{ width:"100%", padding:"14px", borderRadius:18, background:C.surface, border:`1px solid ${C.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <RotateCcw size={16} color={C.textDim} />
            <span style={{ color:C.textDim, fontSize:14 }}>Riprova</span>
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }}
        onChange={e => e.target.files[0] && parseFile(e.target.files[0])} />
      <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
        onChange={e => e.target.files[0] && parseFile(e.target.files[0])} />

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

function fmt(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("it-IT", { month:"short", year:"numeric" }); }
  catch { return iso; }
}
