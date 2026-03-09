// api/parse-bill.js
// PDF  → riceve testo estratto dal browser → modelli testo stabili
// Immagine → riceve base64 → openrouter/free (con retry)

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
  "unita_misura": "kWh" oppure "Smc",
  "totale_pagare": numero in euro o null,
  "prezzo_materia_prima": numero es 0.12636 o null,
  "tipo_prezzo": "FISSO" oppure "VARIABILE",
  "data_scadenza_offerta": "YYYY-MM-DD o null",
  "note": "info rilevanti o null"
}

Regole:
- tipo_utenza: elettricità/luce = LUCE, gas = GAS
- pod_pdr: per luce "POD" + "IT...", per gas "PDR" + numero. OBBLIGATORIO.
- Se un campo non è presente usa null`;

// Modelli TESTO — stabili, confermati nella lista free
const TEXT_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3n-e2b-it:free",
];

async function callModel(model, messages, apiKey) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer":  "https://energyiq-omega.vercel.app",
      "X-Title":       "EnergyIQ",
    },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 1024 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data.choices?.[0]?.message?.content ?? "";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENROUTER_API_KEY non configurata" });

  try {
    const body = await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end",  () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("Body non JSON")); } });
      req.on("error", reject);
    });

    let messages;
    let models;

    if (body.type === "text") {
      // PDF: testo estratto client-side
      if (!body.text || body.text.trim().length < 30)
        return res.status(400).json({ error: "Testo troppo corto" });

      messages = [{ role: "user", content: `${PROMPT}\n\nTESTO BOLLETTA:\n${body.text.slice(0, 8000)}` }];
      models = TEXT_MODELS;

    } else if (body.type === "image") {
      // Immagine: base64
      if (!body.mimeType || !body.data)
        return res.status(400).json({ error: "Campi mimeType e data obbligatori" });

      messages = [{
        role: "user",
        content: [
          { type: "text",      text: PROMPT },
          { type: "image_url", image_url: { url: `data:${body.mimeType};base64,${body.data}` } },
        ],
      }];
      // Per immagini: openrouter/free con retry automatico
      models = ["openrouter/free", "openrouter/free", "openrouter/free"];

    } else {
      return res.status(400).json({ error: "Campo type obbligatorio: 'text' o 'image'" });
    }

    let lastError = null;
    for (const model of models) {
      try {
        const rawText = await callModel(model, messages, apiKey);
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { lastError = `Nessun JSON da ${model}`; continue; }

        let parsed;
        try { parsed = JSON.parse(jsonMatch[0]); }
        catch { lastError = `JSON malformato da ${model}`; continue; }

        if (!parsed.pod_pdr)
          return res.status(422).json({ error: "POD/PDR non trovato nella bolletta." });

        return res.status(200).json({ ok: true, data: parsed, model_used: model });

      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    return res.status(502).json({ error: "Nessun modello disponibile. Riprova.", detail: lastError });

  } catch (err) {
    console.error("parse-bill crash:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
