// api/parse-bill.js
// Doppio Binario ZERO COSTI: Groq per i PDF, OpenRouter (con tappeto di fallback) per le Foto

const GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

async function callOpenRouter(model, messages, apiKey) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://energyiq-omega.vercel.app",
      "X-Title": "EnergyIQ",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 800
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? JSON.stringify(data));
  console.log(`[OR] ${model} OK`);
  return data.choices?.[0]?.message?.content ?? "";
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

  const groqKey = process.env.GROQ_API_KEY;
  const orKey   = process.env.OPENROUTER_API_KEY;

  if (!groqKey && !orKey) return res.status(500).json({ error: "Nessuna API key configurata" });

  try {
    const body = await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data",  chunk => raw += chunk);
      req.on("end",   () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("Body non JSON")); } });
      req.on("error", reject);
    });

    let messages;
    let isVision = false;
    let testoPerRegex = "";

    // ── GESTIONE INPUT (PDF vs FOTO) ──
    if (body.type === "text") {
      if (!body.text || body.text.trim().length < 30) return res.status(400).json({ error: "Testo PDF non leggibile." });
      testoPerRegex = body.text.slice(0, 6000);
      console.log(`[parse-bill] PDF - ${testoPerRegex.length} chars.`);
      messages = [{ role: "user", content: `${PROMPT}\n\nTESTO BOLLETTA:\n${testoPerRegex}` }];
    } else if (body.type === "image") {
      console.log(`[parse-bill] FOTO/SCREENSHOT rilevato.`);
      isVision = true;
      messages = [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: `data:${body.mimeType};base64,${body.data}` } }
        ]
      }];
    } else {
      return res.status(400).json({ error: "Formato non supportato" });
    }

    let parsed = null;
    const errors = [];

    // ── SCELTA MODELLI ──
    const GROQ_TEXT_MODELS = ["qwen/qwen3.6-27b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];
    const OR_TEXT_MODELS   = ["mistralai/mistral-7b-instruct:free", "openchat/openchat-7b:free"];
    
    // Tappeto di modelli Vision GRATUITI attivi su OpenRouter. Se uno è pieno, prova il successivo.
    const OR_VISION_MODELS = [
      "google/gemini-2.0-flash-exp:free", 
      "google/gemini-2.0-flash-thinking-exp:free",
      "meta-llama/llama-3.2-90b-vision-instruct:free",
      "meta-llama/llama-3.2-11b-vision-instruct:free",
      "qwen/qwen-2-vl-72b-instruct:free",
      "qwen/qwen-2-vl-7b-instruct:free"
    ];

    // ── ESECUZIONE ──
    if (isVision) {
      if (orKey) {
        for (const model of OR_VISION_MODELS) {
          try {
            console.log(`[parse-bill] Provo Vision OR: ${model}...`);
            parsed = parseJson(await callOpenRouter(model, messages, orKey));
            break;
          } catch (e) {
            console.error(`[parse-bill] Vision OR ${model} fallito: ${e.message}`);
            errors.push(`Vision OR (${model}): ${e.message}`);
            // Breve pausa per evitare che OpenRouter ci blocchi per troppe chiamate simultanee
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }
    } else {
      // PDF Flow (invariato)
      if (groqKey) {
        for (const model of GROQ_TEXT_MODELS) {
          try {
            console.log(`[parse-bill] Provo Text Groq: ${model}...`);
            parsed = parseJson(await callGroq(model, messages, groqKey));
            break;
          } catch (e) {
            console.error(`[parse-bill] Text Groq ${model} fallito: ${e.message}`);
            errors.push(`Groq (${model}): ${e.message}`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      if (!parsed && orKey) {
        for (const model of OR_TEXT_MODELS) {
          try {
            console.log(`[parse-bill] Provo Text OR: ${model}...`);
            parsed = parseJson(await callOpenRouter(model, messages, orKey));
            break;
          } catch (e) {
            console.error(`[parse-bill] Text OR ${model} fallito: ${e.message}`);
            errors.push(`OR (${model}): ${e.message}`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    }

    if (!parsed) {
      console.error("[parse-bill] Tutti i modelli falliti. Errori:", errors);
      
      // Messaggio di errore personalizzato se la rete gratuita per le foto è tutta intasata
      if (isVision) {
        return res.status(502).json({ error: "I server AI per le immagini sono momentaneamente pieni. Riprova tra un minuto, oppure carica la bolletta in formato PDF." });
      }
      return res.status(502).json({ error: "Servizio AI momentaneamente sovraccarico. Riprova tra poco.", detail: errors.join(" | ") });
    }

    if (!parsed.pod_pdr) return res.status(422).json({ error: "POD o PDR non trovato nell'immagine o nel documento." });

    // ── POST-PROCESSING PREZZO ──
    if (body.prezzo_override != null) {
      parsed.prezzo_materia_prima = body.prezzo_override;
    } else if (!isVision) {
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