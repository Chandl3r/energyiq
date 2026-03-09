// api/parse-bill.js

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PROMPT = `Analizza questa bolletta energetica italiana ed estrai i dati nel seguente formato JSON.
Rispondi SOLO con il JSON, nessun testo aggiuntivo, nessun markdown, nessun backtick.

{
  "tipo_utenza": "LUCE" oppure "GAS",
  "pod_pdr": "codice POD (IT...) o PDR (numerico) - OBBLIGATORIO",
  "fornitore": "nome del fornitore es. A2A Energia",
  "nome_offerta": "nome offerta commerciale o null",
  "data_emissione": "YYYY-MM-DD o null",
  "periodo_inizio": "YYYY-MM-DD o null",
  "periodo_fine": "YYYY-MM-DD o null",
  "consumo_fatturato": numero o null,
  "unita_misura": "kWh" oppure "Smc",
  "totale_pagare": numero o null,
  "prezzo_materia_prima": numero o null,
  "tipo_prezzo": "FISSO" oppure "VARIABILE",
  "data_scadenza_offerta": "YYYY-MM-DD o null",
  "note": "info rilevanti o null"
}

tipo_utenza: energia elettrica o luce = LUCE, gas naturale = GAS.
pod_pdr: cerca "POD" seguito da codice IT..., oppure "PDR" seguito da numero. E' il campo più importante.`;

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

    // Costruisce il contenuto del messaggio
    // Per PDF: OpenRouter supporta il tipo "file" nativo
    // Per immagini: usa image_url base64
    let contentParts;
    if (mimeType === "application/pdf") {
      contentParts = [
        { type: "text", text: PROMPT },
        {
          type: "file",
          file: {
            filename: "bolletta.pdf",
            file_data: `data:application/pdf;base64,${b64data}`,
          },
        },
      ];
    } else {
      // immagine
      contentParts = [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64data}` } },
      ];
    }

    const orRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer":  "https://energyiq-omega.vercel.app",
        "X-Title":       "EnergyIQ",
      },
      body: JSON.stringify({
        model:       "openrouter/free",
        messages:    [{ role: "user", content: contentParts }],
        temperature: 0.1,
        max_tokens:  1024,
      }),
    });

    const orData = await orRes.json();

    if (!orRes.ok) {
      return res.status(502).json({
        error:  "OpenRouter API error",
        detail: orData?.error?.message ?? JSON.stringify(orData).slice(0, 300),
      });
    }

    const rawText = orData.choices?.[0]?.message?.content ?? "";

    // Estrae JSON anche se il modello aggiunge testo attorno
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({
        error:   "Nessun JSON trovato nella risposta del modello",
        rawText: rawText.slice(0, 300),
      });
    }

    let parsed;
    try   { parsed = JSON.parse(jsonMatch[0]); }
    catch { return res.status(422).json({ error: "JSON malformato dal modello", rawText: rawText.slice(0, 300) }); }

    // Validazione minima
    if (!parsed.pod_pdr) {
      return res.status(422).json({
        error:   "POD/PDR non trovato nella bolletta. Prova con un'immagine più nitida o un PDF diverso.",
        rawText: rawText.slice(0, 300),
      });
    }

    return res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    console.error("parse-bill crash:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
