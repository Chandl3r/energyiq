// api/parse-bill.js
// Usa OpenRouter con google/gemini-2.0-flash-exp:free — gratuito senza limiti di billing

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PROMPT = `Analizza questa bolletta energetica italiana ed estrai i dati nel seguente formato JSON.
Rispondi SOLO con il JSON, nessun testo aggiuntivo, nessun markdown, nessun backtick.

{
  "tipo_utenza": "LUCE" oppure "GAS",
  "pod_pdr": "codice POD (IT...) o PDR (numerico)",
  "fornitore": "nome del fornitore (es. A2A Energia)",
  "nome_offerta": "nome dell'offerta commerciale se presente",
  "data_emissione": "YYYY-MM-DD",
  "periodo_inizio": "YYYY-MM-DD",
  "periodo_fine": "YYYY-MM-DD",
  "consumo_fatturato": numero kWh o Smc solo il numero,
  "unita_misura": "kWh" oppure "Smc",
  "totale_pagare": numero in euro solo il numero es 145.32,
  "prezzo_materia_prima": numero es 0.12636,
  "tipo_prezzo": "FISSO" oppure "VARIABILE",
  "data_scadenza_offerta": "YYYY-MM-DD oppure null",
  "note": "eventuali info rilevanti"
}

Se un campo non è presente usa null.
tipo_utenza: energia elettrica o luce = LUCE, gas naturale = GAS.`;

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

    const supported = ["image/jpeg","image/jpg","image/png","image/webp","application/pdf"];
    if (!supported.includes(mimeType)) {
      return res.status(400).json({ error: `Tipo file non supportato: ${mimeType}` });
    }

    // OpenRouter usa formato OpenAI — immagini come URL base64
    const imageUrl = `data:${mimeType};base64,${b64data}`;

    const orRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer":  "https://energyiq-omega.vercel.app",
        "X-Title":       "EnergyIQ",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.2-11b-vision-instruct:free",
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        temperature: 0.1,
        max_tokens:  1024,
      }),
    });

    const orData = await orRes.json();

    if (!orRes.ok) {
      return res.status(502).json({
        error:  "OpenRouter API error",
        detail: orData?.error?.message ?? JSON.stringify(orData),
      });
    }

    const rawText = orData.choices?.[0]?.message?.content ?? "";
    const clean   = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try   { parsed = JSON.parse(clean); }
    catch { return res.status(422).json({ error: "JSON non valido dal modello", rawText: rawText.slice(0, 500) }); }

    return res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    console.error("parse-bill crash:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
