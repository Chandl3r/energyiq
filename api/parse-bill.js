// api/parse-bill.js
// Primario:  Groq (Modelli di Produzione 2026)
// Fallback:  OpenRouter (Modelli gratuiti)

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

// Nuovi modelli presi direttamente dalla Dashboard Groq attuale
const GROQ_MODELS = [
  "qwen/qwen3.6-27b",     // Il più stabile per il parsing
  "openai/gpt-oss-120b",  // Molto intelligente ma limiti severi (ecco perché tagliamo il testo)
  "qwen/qwen3.8-27b"      // Backup aggiuntivo della famiglia Qwen
];

async function callGroq(model, messages, apiKey) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model, 
      messages, 
      temperature: 0.1, 
      max_tokens: 800, // Limite abbassato per evitare l'Error 429 Rate Limit
      response_format: { type: "json_object" } // FORZA IL JSON CORRETTO
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    throw new Error(`${msg}`);
  }
  console.log(`[Groq] ${model} OK`);
  return data.choices?.[0]?.message?.content ?? "";
}

// Modelli storici OpenRouter ad altissima disponibilità
const OR_FALLBACK_MODELS = [
  "mistralai/mistral-7b-instruct:free",
  "openchat/openchat-7b:free"
];

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
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    throw new Error(`${msg}`);
  }
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

  if (!groqKey && !orKey)
    return res.status(500).json({ error: "Nessuna API key configurata" });

  try {
    const body = await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data",  chunk => raw += chunk);
      req.on("end",   () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("Body non JSON")); } });
      req.on("error", reject);
    });

    if (body.type !== "text")
      return res.status(400).json({ error: "Solo PDF supportato (type: text)" });
    if (!body.text || body.text.trim().length < 30)
      return res.status(400).json({ error: "Testo troppo corto" });

    // TAGLIO A 6000 CARATTERI: Previene il superamento del limite "8000 TPM" dei piani gratuiti
    const testo = body.text.slice(0, 6000); 
    console.log(`[parse-bill] ${testo.length} chars elaborati.`);

    const messages = [{ role: "user", content: `${PROMPT}\n\nTESTO BOLLETTA:\n${testo}` }];

    let parsed = null;
    const errors = [];

    if (groqKey) {
      for (const model of GROQ_MODELS) {
        try {
          console.log(`[parse-bill] Provo Groq: ${model}...`);
          parsed = parseJson(await callGroq(model, messages, groqKey));
          break;
        } catch (e) {
          console.error(`[parse-bill] Groq ${model} fallito: ${e.message}`);
          errors.push(`Groq (${model}): ${e.message}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!parsed && orKey) {
      for (const model of OR_FALLBACK_MODELS) {
        try {
          console.log(`[parse-bill] Provo OpenRouter: ${model}...`);
          parsed = parseJson(await callOpenRouter(model, messages, orKey));
          break;
        } catch (e) {
          console.error(`[parse-bill] OR ${model} fallito: ${e.message}`);
          errors.push(`OR (${model}): ${e.message}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!parsed) {
      console.error("[parse-bill] Tutti i modelli falliti. Errori:", errors);
      return res.status(502).json({ error: "Servizio AI momentaneamente sovraccarico. Riprova tra poco.", detail: errors.join(" | ") });
    }

    if (!parsed.pod_pdr)
      return res.status(422).json({ error: "POD o PDR non trovato nella bolletta." });

    if (body.prezzo_override != null) {
      parsed.prezzo_materia_prima = body.prezzo_override;
    } else {
      const prezzoRegex = extractPrezzoRegex(testo);
      if (prezzoRegex !== null) {
        parsed.prezzo_materia_prima = prezzoRegex;
      }
    }

    return res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    console.error("[parse-bill] Errore critico:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 60 };