// api/update-indici.js
// Vercel Cron Job — gira ogni giorno alle 08:00 UTC
// Fetcha PUN (luce) e PSV (gas) dal portale GME e li salva su Supabase
//
// Variabili d'ambiente necessarie su Vercel:
//   SUPABASE_URL          → uguale a VITE_SUPABASE_URL
//   SUPABASE_SERVICE_KEY  → chiave "service_role" (NON anon) da Supabase → Settings → API
//   CRON_SECRET           → stringa random a scelta, es. "energyiq-cron-2024"

const SUPABASE_URL        = process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET          = process.env.CRON_SECRET;

// ─── GME API helpers ──────────────────────────────────────────────────────────

async function fetchPUN(anno, mese) {
  // Prezzo Unico Nazionale mensile — media dei prezzi zonali
  // Fonte: GME open data, endpoint pubblico
  const url = `https://gme.mercatoelettrico.org/DesktopModules/GmePublic/api/MW/GetPUN` +
              `?annoInizio=${anno}&meseInizio=${mese}&annoFine=${anno}&meseFine=${mese}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "EnergyIQ/1.0" }
  });
  if (!res.ok) throw new Error(`GME PUN HTTP ${res.status}`);
  const data = await res.json();
  // La risposta è un array di oggetti { Anno, Mese, PUN }
  // PUN è in €/MWh → convertiamo in €/kWh dividendo per 1000
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  const punMWh = parseFloat(row.PUN ?? row.Pun ?? row.pun ?? 0);
  if (!punMWh) return null;
  return Math.round((punMWh / 1000) * 100000) / 100000; // 5 decimali, €/kWh
}

async function fetchPSV(anno, mese) {
  // PSV = Punto di Scambio Virtuale, indice gas italiano
  // Fonte: GME MGAS open data
  const meseStr = String(mese).padStart(2, "0");
  const url = `https://gme.mercatoelettrico.org/DesktopModules/GmePublic/api/Gas/GetPSV` +
              `?annoInizio=${anno}&meseInizio=${meseStr}&annoFine=${anno}&meseFine=${meseStr}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "EnergyIQ/1.0" }
  });
  if (!res.ok) throw new Error(`GME PSV HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  // PSV già in €/MWh → convertiamo in €/Smc
  // 1 Smc gas ≈ 10.69 kWh (potere calorifico superiore medio ARERA)
  // quindi €/Smc = (€/MWh / 1000) * 10.69
  const psvMWh = parseFloat(row.PSV ?? row.Psv ?? row.psv ?? 0);
  if (!psvMWh) return null;
  const psvSmc = (psvMWh / 1000) * 10.69;
  return Math.round(psvSmc * 100000) / 100000; // 5 decimali, €/Smc
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────

async function upsertIndice(tipo, meseAnno, valore) {
  // meseAnno formato "YYYY-MM-01"
  const url = `${SUPABASE_URL}/rest/v1/indici_mercato`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "resolution=merge-duplicates",  // upsert
    },
    body: JSON.stringify({
      tipo_indice:  tipo,          // "PUN" o "PSV"
      mese_anno:    meseAnno,      // "2025-01-01"
      valore_medio: valore,
      fonte:        "GME",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert ${tipo} failed: ${err}`);
  }
}

// ─── Handler principale ───────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Protezione: Vercel invia automaticamente l'header per i cron,
  // ma proteggiamo anche con CRON_SECRET per chiamate manuali
  const authHeader = req.headers["authorization"];
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const isManual = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isVercelCron && !isManual) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now   = new Date();
  const anno  = now.getFullYear();
  const mese  = now.getMonth() + 1; // mese corrente

  // Fetchiamo anche il mese precedente (spesso quello più recente disponibile)
  const mesePrecedente = mese === 1 ? 12 : mese - 1;
  const annoPrecedente = mese === 1 ? anno - 1 : anno;

  const results = [];
  const errors  = [];

  for (const [a, m] of [[annoPrecedente, mesePrecedente], [anno, mese]]) {
    const meseAnnoStr = `${a}-${String(m).padStart(2,"0")}-01`;

    try {
      const pun = await fetchPUN(a, m);
      if (pun) {
        await upsertIndice("PUN", meseAnnoStr, pun);
        results.push(`PUN ${meseAnnoStr}: ${pun} €/kWh`);
      } else {
        results.push(`PUN ${meseAnnoStr}: non disponibile`);
      }
    } catch (e) {
      errors.push(`PUN ${meseAnnoStr}: ${e.message}`);
    }

    try {
      const psv = await fetchPSV(a, m);
      if (psv) {
        await upsertIndice("PSV", meseAnnoStr, psv);
        results.push(`PSV ${meseAnnoStr}: ${psv} €/Smc`);
      } else {
        results.push(`PSV ${meseAnnoStr}: non disponibile`);
      }
    } catch (e) {
      errors.push(`PSV ${meseAnnoStr}: ${e.message}`);
    }
  }

  console.log("[update-indici] results:", results);
  if (errors.length) console.warn("[update-indici] errors:", errors);

  return res.status(200).json({
    ok: errors.length === 0,
    updated: results,
    errors,
    timestamp: now.toISOString(),
  });
}
