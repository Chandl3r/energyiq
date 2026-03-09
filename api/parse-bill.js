// api/parse-bill.js
// Strategia definitiva:
// - PDF  → estrae testo con pdf-parse (server-side) → manda testo al LLM (niente vision)
// - Immagine → manda base64 al modello vision

import pdfParse from "pdf-parse";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Modelli testo (per PDF con testo estratto) — molto più affidabili dei vision free
const TEXT_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemma-3-27b-it:free",
];

// Modelli vision (per immagini)
const VISION_MODELS = [
  "qwen/qwen2.5-vl-72b-instruct:free",
  "google/gemma-3-27b-it:free",
];

const buildPrompt = (testoOImmagine) => `Analizza questa bolletta energetica italiana ed estrai i dati nel seguente formato JSON.
Rispondi SOLO con il JSON, nessun testo aggiuntivo, nessun markdown, nessun backtick.

{
  "tipo_utenza": "LUCE" oppure "GAS",
  "pod_pdr": "codice POD (IT...) o PDR (numerico)",
  "intestatario": "nome e cognome intestatario della bolletta",
  "fornitore": "nome del fornitore es. HERA, A2A Energia, Enel",
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
- pod_pdr: per luce "POD" + "IT...", per gas "PDR" + numero. Campo OBBLIGATORIO.
- Se un campo non è presente usa null

${testoOImmagine}`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENROUTER_API_KEY non configurata" });

  try {
    // Legge body
    const body = await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", chunk => raw += chunk);
      req.on("end",  () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error("Body non è JSON valido")); }
      });
      req.on("error", reject);
    });

    const { mimeType, data: b64data } = body;
    if (!mimeType || !b64data) {
      return res.status(400).json({ error: "Campi mimeType e data obbligatori" });
    }

    let messages;
    let models;

    if (mimeType === "application/pdf") {
      // ── PDF: estrai testo server-side ─────────────────────────────
      const pdfBuffer = Buffer.from(b64data, "base64");
      let testoPdf = "";
      try {
        const parsed = await pdfParse(pdfBuffer);
        testoPdf = parsed.text?.slice(0, 8000) ?? ""; // max 8000 char
      } catch (e) {
        return res.status(422).json({ error: "Impossibile estrarre testo dal PDF. Prova a fotografare la bolletta." });
      }

      if (testoPdf.trim().length < 50) {
        return res.status(422).json({ error: "PDF senza testo selezionabile (è una scansione). Fotografa la bolletta invece di caricare il PDF." });
      }

      const prompt = buildPrompt(`TESTO DELLA BOLLETTA:\n${testoPdf}`);
      messages = [{ role: "user", content: prompt }];
      models   = TEXT_MODELS;

    } else {
      // ── Immagine: usa vision ───────────────────────────────────────
      const prompt = buildPrompt("Analizza l'immagine della bolletta qui sopra:");
      messages = [{
        role: "user",
        content: [
          { type: "text",      text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64data}` } },
        ],
      }];
      models = VISION_MODELS;
    }

    // ── Prova i modelli in ordine ─────────────────────────────────────
    let lastError = null;

    for (const model of models) {
      try {
        const orRes = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer":  "https://energyiq-omega.vercel.app",
            "X-Title":       "EnergyIQ",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.1,
            max_tokens:  1024,
          }),
        });

        const orData = await orRes.json();

        if (!orRes.ok) {
          lastError = orData?.error?.message ?? `HTTP ${orRes.status} da ${model}`;
          console.warn(`${model} errore:`, lastError);
          continue;
        }

        const rawText = orData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          lastError = `Nessun JSON da ${model}`;
          console.warn(lastError, rawText.slice(0, 200));
          continue;
        }

        let parsed;
        try { parsed = JSON.parse(jsonMatch[0]); }
        catch {
          lastError = `JSON malformato da ${model}`;
          console.warn(lastError);
          continue;
        }

        if (!parsed.pod_pdr) {
          return res.status(422).json({
            error: "POD/PDR non trovato nella bolletta. Controlla che il PDF contenga il codice POD o PDR.",
          });
        }

        return res.status(200).json({ ok: true, data: parsed, model_used: model });

      } catch (fetchErr) {
        lastError = fetchErr.message;
        console.warn(`Errore fetch ${model}:`, fetchErr.message);
        continue;
      }
    }

    return res.status(502).json({
      error:  "Nessun modello disponibile al momento. Riprova tra qualche minuto.",
      detail: lastError,
    });

  } catch (err) {
    console.error("parse-bill crash:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
