// api/parse-bill.js
// Primario:  Groq  (gratuito, 14.400 req/giorno, nessuna carta)
// Fallback:  OpenRouter free models
// Post-processing: regex deterministico per prezzo_materia_prima (non dipende dall'LLM)

const GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PROMPT = `Analizza questa bolletta energetica italiana ed estrai i dati nel seguente formato JSON.
Rispondi SOLO con il JSON, nessun testo aggiuntivo, nessun markdown, nessun backtick.

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

2. pod_pdr: per luce il codice POD inizia con "IT" (es. IT012E00367605), per gas il PDR è numerico (es. 05260200451415). OBBLIGATORIO.

3. consumo_fatturato: il consumo del PERIODO di questa bolletta (es. "Consumo totale fatturato del periodo"). NON usare il consumo annuo qui.

4. consumo_annuo: il consumo annuale dalla sezione "CONSUMO ANNUO" (es. 5268 kWh oppure 817 Smc).

5. prezzo_materia_prima: prendi il prezzo DAL BOX DELL'OFFERTA, NON dallo Scontrino dell'Energia.
   - Cerca pattern come "Prezzo Fisso(Dic.25)=0,12636 euro/kWh" - estrai 0.12636
   - Cerca pattern come "Prezzo Fisso(Gen.26)=0,513393 euro/Smc" - estrai 0.513393
   - NON usare il "Prezzo medio" dello Scontrino (include rete e oneri, non e materia prima).

6. storico_mensile: estrai TUTTI i mesi da grafici/tabelle storiche. Formato:
   - "mese": YYYY-MM (converti "Ott 24" in "2024-10")
   - "consumo": numero mensile effettivo, NON cumulativo
   Se assente, usa [].

7. Se un campo non e presente usa null.`;

// Regex deterministico per prezzo materia prima (post-processing, sovrascrive LLM)
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

async function callGroq(messages, apiKey) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, temperature: 0.1, max_tokens: 1500 }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    console.error(`[Groq] HTTP ${res.status}: ${msg}`);
    throw new Error(`Groq HTTP ${res.status}: ${msg}`);
  }
  console.log("[Groq] OK");
  return data.choices?.[0]?.message?.content ?? "";
}

const OR_FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
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
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 1500 }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    console.error(`[OR] ${model} HTTP ${res.status}: ${msg}`);
    throw new Error(`${model}: HTTP ${res.status} — ${msg}`);
  }
  console.log(`[OR] ${model} OK`);
  return data.choices?.[0]?.message?.content ?? "";
}

function parseJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Nessun JSON nella risposta");
  return JSON.parse(m[0]);
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

    const testoOriginale = body.text;
    const testo = body.text.slice(0, 12000);
    console.log(`[parse-bill] ${testo.length} chars`);

    const messages = [{ role: "user", content: `${PROMPT}\n\nTESTO BOLLETTA:\n${testo}` }];

    let parsed = null;
    const errors = [];

    // Primario: Groq (gratuito)
    if (groqKey) {
      try {
        parsed = parseJson(await callGroq(messages, groqKey));
      } catch (e) {
        errors.push(`Groq: ${e.message}`);
      }
    }

    // Fallback: OpenRouter free
    if (!parsed && orKey) {
      for (const model of OR_FALLBACK_MODELS) {
        try {
          parsed = parseJson(await callOpenRouter(model, messages, orKey));
          break;
        } catch (e) {
          errors.push(e.message);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    if (!parsed) {
      console.error("[parse-bill] tutti falliti:", errors);
      return res.status(502).json({ error: "Parsing non riuscito. Riprova.", detail: errors.join(" | ") });
    }

    if (!parsed.pod_pdr)
      return res.status(422).json({ error: "POD/PDR non trovato nella bolletta." });

    // Post-processing: regex sovrascrive prezzo LLM (deterministico e affidabile)
    const prezzoRegex = extractPrezzoRegex(testoOriginale);
    if (prezzoRegex !== null) {
      console.log(`[parse-bill] prezzo regex: ${prezzoRegex} (LLM: ${parsed.prezzo_materia_prima})`);
      parsed.prezzo_materia_prima = prezzoRegex;
    }

    return res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    console.error("[parse-bill] crash:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 60 };
