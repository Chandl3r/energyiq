// api/parse-bill.js
// Doppio Binario: Groq (gratuiti) per i PDF, API ufficiale Google Gemini per le Foto con Fallback

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const PROMPT = `Analizza questa bolletta energetica italiana ed estrai i dati nel seguente formato JSON.
Rispondi SOLO ed ESCLUSIVAMENTE con il JSON strutturato esattamente in questo modo, senza backtick o testo aggiuntivo.

{
  "tipo_utenza": "LUCE" oppure "GAS",
  "pod_pdr": "codice POD (IT...) o PDR (numerico)",
  "intestatario": "nome e cognome intestatario della bolletta",
  "fornitore": "nome del fornitore es. A2A Energia",
  "nome_offerta": "nome offerta commerciale o null",
  "data_emissione": "YYYY-MM-DD o null",
  "periodo_inizio": "YYYY-MM-DD o null",
  "periodo_fine": "YYYY-MM-DD o null",
  "consumo_fatturato": numero o null,
  "consumo_annuo": numero o null,
  "unita_misura": "kWh" oppure "Smc",
  "totale_pagare": numero in euro o null,
  "prezzo_materia_prima": numero es 0.12636 o null,
  "tipo_prezzo": "FISSO" oppure "VARIABILE",
  "data_scadenza_offerta": "YYYY-MM-DD o null",
  "storico_mensile": [
    {"mese": "YYYY-MM", "consumo": numero}
  ],
  "note": "info rilevanti o null"
}

Regole OBBLIGATORIE:
1. tipo_utenza: elettricità/luce = LUCE, gas = GAS
2. pod_pdr: per luce il codice POD inizia con "IT", per gas il PDR è numerico.
3. consumo_fatturato: il consumo del PERIODO di questa bolletta.
4. consumo_annuo: il consumo annuale dalla sezione "CONSUMO ANNUO".
5. prezzo_materia_prima: prendi il prezzo DAL BOX DELL'OFFERTA, NON dallo Scontrino. Estrai solo il numero (es 0.12636).
6. storico_mensile: estrai TUTTI i mesi. Formato: "mese": YYYY-MM, "consumo": numero effettivo. Se assente, usa [].
7. Se un campo non e presente usa null.`;

function extractPrezzoRegex(testo) {
  const patterns = [
    /Prezzo\s+Fisso\s*(?:\([^)]*\))?\s*=\s*([\d]+[,.][\d]+)\s*[€euro]*\s*\/\s*(?:kWh|Smc)/i,
    /Prezzo\s+Energia\s*(?:Fisso\s*)?(?:\([^)]*\))?\s*=\s*([\d]+[,.][\d]+)\s*[€euro]*\s*\/\s*(?:kWh|Smc)/i,
    /=\s*(0[,.][\d]{4,6})\s*[€]\s*\/\s*kWh/,
    /=\s*(0[,.][\d]{4,6})\s*[€]\s*\/\s*Smc/,
  ];
  for (const re of patterns) {
    const m = testo.match(re);
    if (m) {
      const val = parseFloat(m[1].replace(",", "."));
      if (val > 0.01 && val < 5) return val;
    }
  }
  return null;
}

// Funzione per chiamare Groq (PDF Testuali)
async function callGroq(model, messages, apiKey) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: "json_object" }
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? JSON.stringify(data));
  console.log(`[Groq] ${model} OK`);
  return data.choices?.[0]?.message?.content ?? "";
}

// Funzione diretta per Google Gemini API (Immagini/Foto)
async function callGeminiDirect(prompt, base64Data, mimeType, apiKey, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Errore Gemini API");
  
  console.log(`[Gemini Direct] ${modelName} OK`);
  return data.candidates[0].content.parts[0].text;
}

function parseJson(raw) {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Nessun JSON trovato nel testo");
    return JSON.parse(m[0]);
  } catch (err) {
    throw new Error(`Errore di validazione JSON: ${err.message}`);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const groqKey   = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) return res.status(500).json({ error: "API keys non configurate" });

  try {
    const body = await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data",  chunk => raw += chunk);
      req.on("end",   () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("Body non JSON")); } });
      req.on("error", reject);
    });

    let parsed = null;
    let testoPerRegex = "";
    const errors = [];

    // ── GESTIONE IMMAGINI (FOTO) ──
    if (body.type === "image") {
      console.log(`[parse-bill] FOTO rilevata. Inizio routine Gemini.`);
      if (!geminiKey) return res.status(500).json({ error: "API Key di Gemini non configurata su Vercel." });
      
      // Modelli aggiornati in base ai suggerimenti di errore di Google
      const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
      
      for (const model of GEMINI_MODELS) {
        try {
          parsed = parseJson(await callGeminiDirect(PROMPT, body.data, body.mimeType, geminiKey, model));
          break; 
        } catch (e) {
          console.error(`[parse-bill] Gemini ${model} fallito: ${e.message}`);
          errors.push(`Gemini (${model}): ${e.message}`);
        }
      }

      if (!parsed) {
        return res.status(502).json({ error: "Servizio Google AI momentaneamente sovraccarico per le immagini. Riprova.", detail: errors.join(" | ") });
      }
    } 
    // ── GESTIONE TESTO (PDF) ──
    else if (body.type === "text") {
      if (!body.text || body.text.trim().length < 30) return res.status(400).json({ error: "Testo PDF non leggibile." });
      testoPerRegex = body.text.slice(0, 6000);
      console.log(`[parse-bill] PDF rilevato - Uso Groq.`);
      
      const messages = [{ role: "user", content: `${PROMPT}\n\nTESTO BOLLETTA:\n${testoPerRegex}` }];
      const GROQ_TEXT_MODELS = ["qwen/qwen3.6-27b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

      if (groqKey) {
        for (const model of GROQ_TEXT_MODELS) {
          try {
            parsed = parseJson(await callGroq(model, messages, groqKey));
            break; 
          } catch (e) {
            console.error(`[parse-bill] Groq ${model} fallito: ${e.message}`);
            errors.push(`Groq (${model}): ${e.message}`);
          }
        }
      }

      if (!parsed) {
        return res.status(502).json({ error: "Servizio AI momentaneamente sovraccarico per i PDF. Riprova tra poco.", detail: errors.join(" | ") });
      }
    } else {
      return res.status(400).json({ error: "Formato non supportato" });
    }

    if (!parsed || !parsed.pod_pdr) return res.status(422).json({ error: "Dati non trovati nel documento." });

    // ── POST-PROCESSING PREZZO ──
    if (body.prezzo_override != null) {
      parsed.prezzo_materia_prima = body.prezzo_override;
    } else if (body.type === "text") {
      const prezzoRegex = extractPrezzoRegex(testoPerRegex);
      if (prezzoRegex !== null) parsed.prezzo_materia_prima = prezzoRegex;
    }

    return res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    console.error("[parse-bill] Errore critico:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
export const config = { maxDuration: 60 };