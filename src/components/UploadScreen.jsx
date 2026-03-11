// src/components/UploadScreen.jsx
// PDF  → pdfjs-dist (npm, bundled da Vite) → estrae testo → manda testo al server
// Immagine → base64 → server

import { useState, useRef } from "react";
import { Camera, FileText, CheckCircle, AlertCircle, Loader2, Save, RotateCcw } from "lucide-react";
import { supabase } from "../lib/supabase";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

// Configura il worker (Vite lo gestisce automaticamente)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const C = {
  bg:"#080808", surface:"#111111", surface2:"#181818",
  border:"#1e1e1e", border2:"#252525",
  amber:"#f59e0b", amberDim:"#f59e0b20", amberMid:"#f59e0b40",
  sky:"#38bdf8", skyDim:"#38bdf820",
  green:"#22c55e", greenDim:"#22c55e18",
  red:"#ef4444", redDim:"#ef444415",
  text:"#ffffff", textMid:"#9ca3af", textDim:"#4b5563",
};

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text.trim();
}

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

  const reset = () => { setFase("idle"); setErrore(null); setDatiEstrat(null); setFileName(null); };

  const parseFile = async (file) => {
    setFileName(file.name);
    setFase("parsing");
    setErrore(null);
    try {
      const isPdf = file.type === "application/pdf" || file.name?.endsWith(".pdf");
      let payload;

      if (isPdf) {
        const testo = await extractPdfText(file);
        if (!testo || testo.length < 50)
          throw new Error("PDF senza testo selezionabile. Prova a fotografare la bolletta.");

        // ── DEBUG: mostra quante pagine e quanti chars sono stati estratti ──
        console.log("=== PDF DEBUG ===");
        console.log("Lunghezza testo estratto:", testo.length, "chars");
        // Cerca keyword storico nel testo
        const lower = testo.toLowerCase();
        const idxStorico = lower.search(/storico|informazioni storiche|andamento|consumo ann/);
        if (idxStorico >= 0) {
          console.log("✅ Trovata sezione storico a posizione:", idxStorico);
          console.log("Estratto intorno allo storico:", testo.slice(Math.max(0, idxStorico-100), idxStorico+500));
        } else {
          console.log("❌ Sezione storico NON trovata nel testo estratto dal PDF");
        }
        console.log("=================");

        payload = { type: "text", text: testo };
      } else {
        const b64  = await fileToBase64(file);
        const mime = file.type || "image/jpeg";
        payload = { type: "image", mimeType: mime, data: b64 };
      }

      const res  = await fetch("/api/parse-bill", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? `HTTP ${res.status}`);

      // ── DEBUG: mostra cosa ha estratto il modello ──
      console.log("=== LLM OUTPUT DEBUG ===");
      console.log("Modello usato:", json.model_used);
      console.log("storico_mensile:", JSON.stringify(json.data?.storico_mensile));
      console.log("consumo_fatturato:", json.data?.consumo_fatturato);
      console.log("consumo_annuo:", json.data?.consumo_annuo);
      console.log("========================");

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
      // Normalizza date italiane → YYYY-MM-DD
      const mesi = { gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
                     luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12 };
      const normalizzaData = (s) => {
        if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
        if (m) {
          const mese = mesi[m[2].toLowerCase()];
          if (mese) return `${m[3]}-${String(mese).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
        }
        return null;
      };
      // Normalizza numeri — estrae solo la parte numerica da stringhe come "80.0 Smc" o "145,32 €"
      const normalizzaNumero = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === "number") return v;
        const s = String(v).replace(",", "."); // gestisce virgola decimale italiana
        const m = s.match(/[\d.]+/);
        return m ? parseFloat(m[0]) : null;
      };
      const d = {
        ...datiEstrat,
        data_emissione:        normalizzaData(datiEstrat.data_emissione),
        periodo_inizio:        normalizzaData(datiEstrat.periodo_inizio),
        periodo_fine:          normalizzaData(datiEstrat.periodo_fine),
        data_scadenza_offerta: normalizzaData(datiEstrat.data_scadenza_offerta),
        consumo_fatturato:     normalizzaNumero(datiEstrat.consumo_fatturato),
        totale_pagare:         normalizzaNumero(datiEstrat.totale_pagare),
        prezzo_materia_prima:  normalizzaNumero(datiEstrat.prezzo_materia_prima),
      };
      const podPdr = d.pod_pdr ?? `SCONOSCIUTO-${Date.now()}`;

      const { data: esistente, error: errQ } = await supabase
        .from("forniture").select("id")
        .eq("utente_id", user.id).eq("pod_pdr", podPdr).maybeSingle();
      if (errQ) throw new Error(`Errore ricerca fornitura: ${errQ.message}`);

      let fornituraId;
      if (esistente) {
        fornituraId = esistente.id;
        if (d.intestatario)
          await supabase.from("forniture").update({ intestatario: d.intestatario }).eq("id", fornituraId);
      } else {
        const { data: nuova, error: errF } = await supabase
          .from("forniture").insert({
            utente_id:             user.id,
            tipo_utenza:           d.tipo_utenza ?? "LUCE",
            pod_pdr:               podPdr,
            fornitore:             d.fornitore ?? "Sconosciuto",
            nome_offerta:          d.nome_offerta,
            intestatario:          d.intestatario,
            data_scadenza_offerta: d.data_scadenza_offerta,
          }).select("id").single();
        if (errF) throw new Error(`Errore creazione fornitura: ${errF.message}`);
        fornituraId = nuova.id;

        if (d.prezzo_materia_prima) {
          await supabase.from("tariffe").insert({
            fornitura_id:         fornituraId,
            tipo_prezzo:          d.tipo_prezzo ?? "FISSO",
            prezzo_materia_prima: d.prezzo_materia_prima,
            data_inizio:          d.periodo_inizio ?? new Date().toISOString().slice(0,10),
            data_fine:            d.data_scadenza_offerta,
          });
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
                <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 3px" }}>Foto / Screenshot</p>
                <p style={{ color:C.textDim, fontSize:11, margin:0, lineHeight:1.4 }}>Fotocamera o<br/>rullino foto</p>
              </div>
            </button>
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
            <p style={{ color:C.textMid, fontSize:12, fontWeight:600, margin:"0 0 10px" }}>💡 Come funziona</p>
            {["Carica il PDF oppure una foto della bolletta","L'AI estrae automaticamente prezzi, consumi e POD/PDR","Controlla i dati e salvali con un tap"].map((t,i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:i<2?10:0 }}>
                <div style={{ background:C.amberDim, borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:C.amber, fontSize:10, fontWeight:700 }}>{i+1}</span>
                </div>
                <p style={{ color:C.textMid, fontSize:12, margin:0, lineHeight:1.5 }}>{t}</p>
              </div>
            ))}
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
          <p style={{ color:C.textDim, fontSize:11, textAlign:"center", lineHeight:1.6 }}>Può richiedere 15–30 secondi</p>
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
              ["Intestatario",     datiEstrat.intestatario],
              ["Fornitore",        datiEstrat.fornitore],
              ["Offerta",          datiEstrat.nome_offerta],
              [datiEstrat.tipo_utenza === "LUCE" ? "POD" : "PDR", datiEstrat.pod_pdr],
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
            {/* Storico mensile estratto */}
            {(() => {
              const storico = datiEstrat.storico_mensile ?? [];
              return (
                <div style={{ borderTop:`1px solid #1e1e1e`, paddingTop:10, marginTop:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ color:C.textDim, fontSize:12 }}>Storico mensile</span>
                    <span style={{
                      background: storico.length > 0 ? C.greenDim : "#2a1500",
                      color:      storico.length > 0 ? C.green    : "#f97316",
                      fontSize:10, fontWeight:700, borderRadius:20, padding:"2px 8px"
                    }}>
                      {storico.length > 0 ? `${storico.length} mesi estratti` : "Non trovato nel PDF"}
                    </span>
                  </div>
                  {storico.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {storico.slice(-6).map((s,i) => (
                        <div key={i} style={{ background:C.surface2, borderRadius:8, padding:"3px 8px", fontSize:10 }}>
                          <span style={{ color:C.textMid }}>{s.mese?.slice(0,7)} </span>
                          <span style={{ color:C.text, fontWeight:600 }}>{s.consumo}</span>
                        </div>
                      ))}
                      {storico.length > 6 && <span style={{ color:C.textDim, fontSize:10, alignSelf:"center" }}>+{storico.length-6} altri</span>}
                    </div>
                  )}
                  {storico.length === 0 && (
                    <p style={{ color:C.textDim, fontSize:11, margin:0, lineHeight:1.5 }}>
                      Il grafico mostrerà solo il periodo di questa bolletta. Carica più bollette per espandere lo storico, oppure importa i dati ARERA.
                    </p>
                  )}
                </div>
              );
            })()}
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
              <p style={{ color:C.textDim, fontSize:12, margin:0, lineHeight:1.6 }}>Torna alla Home per vedere i grafici aggiornati.</p>
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

      <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display:"none" }}
        onChange={e => e.target.files[0] && parseFile(e.target.files[0])} />
      <input ref={imgRef} type="file" accept="image/*" style={{ display:"none" }}
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
