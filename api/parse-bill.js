// api/parse-bill.js
// Vercel Serverless Function — riceve un file (PDF o immagine),
// lo invia a Gemini Vision e restituisce i dati strutturati della bolletta.
// Gira server-side: la GEMINI_API_KEY non è mai esposta al browser.

export const config = { api: { bodyParser: false } };

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ── Legge il body come Buffer (no bodyParser) ─────────────────
async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ── Estrae un campo multipart grezzo ─────────────────────────
function parseMultipart(buffer, boundary) {
  const sep    = Buffer.from(`--${boundary}`);
  const parts  = [];
  let   start  = 0;

  while (true) {
    const idx = buffer.indexOf(sep, start);
    if (idx === -1) break;
    const end = buffer.indexOf(sep, idx + sep.length);
    if (end === -1) break;
    const part = buffer.slice(idx + sep.length + 2, end - 2); // strip \r\n
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) { start = end; continue; }
    const headers  = part.slice(0, headerEnd).toString();
    const body     = part.slice(headerEnd + 4);
    const nameMatch = headers.match(/name="([^"]+)"/);
    const typeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);
    parts.push({
      name:        nameMatch ? nameMatch[1] : "",
      contentType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
      data:        body,
    });
    start = end;
  }
  return parts;
}

// ── Prompt per Gemini ─────────────────────────────────────────
const PROMPT = `Analizza questa bolletta energetica italiana ed estrai i dati nel seguente formato JSON.
Rispondi SOLO con il JSON, nessun testo aggiuntivo, nessun markdown.

{
  "tipo_utenza": "LUCE" oppure "GAS",
  "pod_pdr": "codice POD (IT...) o PDR (numerico)",
  "fornitore": "nome del fornitore (es. A2A Energia)",
  "nome_offerta": "nome dell'offerta commerciale se presente",
  "data_emissione": "YYYY-MM-DD",
  "periodo_inizio": "YYYY-MM-DD",
  "periodo_fine": "YYYY-MM-DD",
  "consumo_fatturato": numero (kWh o Smc, solo il numero),
  "unita_misura": "kWh" oppure "Smc",
  "totale_pagare": numero in euro (solo il numero, es. 145.32),
  "prezzo_materia_prima": numero €/kWh o €/Smc (solo il numero, es. 0.12636),
  "tipo_prezzo": "FISSO" oppure "VARIABILE",
  "data_scadenza_offerta": "YYYY-MM-DD oppure null se non presente",
  "note": "eventuali informazioni rilevanti non catturate sopra"
}

Se un campo non è presente nella bolletta usa null.
Per tipo_utenza: se vedi "energia elettrica" o "luce" → "LUCE", se vedi "gas naturale" → "GAS".`;

// ── Handler principale ────────────────────────────────────────
export default async function handler(req, res) {
  // CORS per chiamate dal browser
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY non configurata" });

  try {
    const rawBody  = await readBody(req);
    const ct       = req.headers["content-type"] ?? "";
    const bMatch   = ct.match(/boundary=([^\s;]+)/);
    if (!bMatch) return res.status(400).json({ error: "Content-Type boundary mancante" });

    const parts    = parseMultipart(rawBody, bMatch[1]);
    const filePart = parts.find((p) => p.name === "file");
    if (!filePart) return res.status(400).json({ error: "Campo 'file' mancante" });

    const mimeType = filePart.contentType;
    const b64data  = filePart.data.toString("base64");

    // Gemini accetta: image/jpeg, image/png, image/webp, application/pdf
    const supportedTypes = ["image/jpeg","image/jpg","image/png","image/webp","application/pdf"];
    if (!supportedTypes.includes(mimeType)) {
      return res.status(400).json({ error: `Tipo file non supportato: ${mimeType}` });
    }

    // Chiamata a Gemini Vision
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
        generationConfig: {
          temperature:     0.1,   // bassa per output deterministico
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: "Gemini API error", detail: errText });
    }

    const geminiData = await geminiRes.json();
    const rawText    = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Pulisce eventuali backtick markdown
    const clean = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(422).json({
        error:   "Gemini non ha restituito JSON valido",
        rawText: rawText.slice(0, 500),
      });
    }

    return res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    console.error("parse-bill error:", err);
    return res.status(500).json({ error: err.message });
  }
}
