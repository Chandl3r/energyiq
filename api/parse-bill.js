// api/parse-bill.js
// Riceve JSON { mimeType, data (base64) } — niente multipart, niente parser custom.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY non configurata" });

  try {
    // Legge il body JSON
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

    // Chiama Gemini Vision
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: b64data } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(502).json({
        error:  "Gemini API error",
        detail: geminiData?.error?.message ?? JSON.stringify(geminiData),
      });
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean   = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try   { parsed = JSON.parse(clean); }
    catch { return res.status(422).json({ error: "JSON non valido da Gemini", rawText: rawText.slice(0,500) }); }

    return res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    console.error("parse-bill crash:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
