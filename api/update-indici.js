// api/update-indici.js
// Vercel Cron Job — gira ogni giorno alle 08:00 UTC
// Fetcha PUN (luce) e PSV (gas) da mercatoelettrico.org e li salva su Supabase
//
// Variabili d'ambiente:
//   SUPABASE_URL           → uguale a VITE_SUPABASE_URL
//   SUPABASE_SERVICE_KEY   → chiave "service_role" da Supabase → Settings → API
//   CRON_SECRET            → stringa random, es. "energyiq-cron-2026"

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET          = process.env.CRON_SECRET;

// ─── Helpers data ─────────────────────────────────────────────────────────────

function ultimoGiornoMese(anno, mese) {
  return new Date(anno, mese, 0); // giorno 0 del mese successivo = ultimo del corrente
}

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ─── Fetch PUN giornaliero ────────────────────────────────────────────────────
// URL: https://www.mercatoelettrico.org/It/WebServerDataStore/MGP_Prezzi/YYYYMMDDMGPPrezzi.xml
// PUN in €/MWh (virgola come decimale) → divide per 1000 = €/kWh

async function fetchPUNGiorno(dateStr) {
  const url = `https://www.mercatoelettrico.org/It/WebServerDataStore/MGP_Prezzi/${dateStr}MGPPrezzi.xml`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 EnergyIQ/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} per ${dateStr}`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<PUN>([\d,]+)<\/PUN>/g)];
  if (!matches.length) throw new Error(`Nessun PUN nel XML di ${dateStr}`);
  const valori = matches.map(m => parseFloat(m[1].replace(",", ".")));
  return valori.reduce((a, b) => a + b, 0) / valori.length; // media €/MWh
}

async function fetchPUNMensile(anno, mese) {
  const ultimo = ultimoGiornoMese(anno, mese);
  const valori = [];
  const errori = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(ultimo);
    d.setDate(ultimo.getDate() - i);
    if (d > new Date()) continue;
    try { valori.push(await fetchPUNGiorno(fmt(d))); }
    catch (e) { errori.push(`${fmt(d)}: ${e.message}`); }
  }
  if (!valori.length) throw new Error(`Nessun dato PUN per ${anno}-${mese}. ${errori.join("; ")}`);
  const mediaMWh = valori.reduce((a, b) => a + b, 0) / valori.length;
  return Math.round((mediaMWh / 1000) * 100000) / 100000; // €/kWh, 5 decimali
}

// ─── Fetch PSV giornaliero ────────────────────────────────────────────────────
// URL: https://www.mercatoelettrico.org/It/WebServerDataStore/MGAS_Prezzi/YYYYMMDDMGASPrezzi.xml
// PSV in €/MWh → divide per 93.54 = €/Smc (coefficiente ARERA)

async function fetchPSVGiorno(dateStr) {
  const url = `https://www.mercatoelettrico.org/It/WebServerDataStore/MGAS_Prezzi/${dateStr}MGASPrezzi.xml`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 EnergyIQ/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} per ${dateStr}`);
  const xml = await res.text();
  const matches = [
    ...xml.matchAll(/<PSV>([\d,]+)<\/PSV>/g),
    ...xml.matchAll(/<PCVPSV>([\d,]+)<\/PCVPSV>/g),
  ];
  if (!matches.length) throw new Error(`Nessun PSV nel XML di ${dateStr}`);
  const valori = matches.map(m => parseFloat(m[1].replace(",", ".")));
  return valori.reduce((a, b) => a + b, 0) / valori.length; // media €/MWh
}

async function fetchPSVMensile(anno, mese) {
  const ultimo = ultimoGiornoMese(anno, mese);
  const valori = [];
  const errori = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(ultimo);
    d.setDate(ultimo.getDate() - i);
    if (d > new Date()) continue;
    try { valori.push(await fetchPSVGiorno(fmt(d))); }
    catch (e) { errori.push(`${fmt(d)}: ${e.message}`); }
  }
  if (!valori.length) throw new Error(`Nessun dato PSV per ${anno}-${mese}. ${errori.join("; ")}`);
  const mediaMWh = valori.reduce((a, b) => a + b, 0) / valori.length;
  // €/MWh ÷ 93.54 = €/Smc  (potere calorifico superiore medio ARERA)
  return Math.round((mediaMWh / 93.54) * 100000) / 100000;
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────

async function upsertIndice(tipo, meseAnno, valore) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/indici_mercato`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({ tipo_indice: tipo, mese_anno: meseAnno, valore_medio: valore, fonte: "GME" }),
  });
  if (!res.ok) throw new Error(`Supabase upsert ${tipo} fallito: ${await res.text()}`);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const isManual = CRON_SECRET && req.headers["authorization"] === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !isManual) return res.status(401).json({ error: "Unauthorized" });

  const now = new Date();
  const target = [
    { anno: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      mese: now.getMonth() === 0 ? 12 : now.getMonth() },   // mese precedente (dati definitivi)
    { anno: now.getFullYear(), mese: now.getMonth() + 1 },   // mese corrente (dati parziali)
  ];

  const results = [], errors = [];

  for (const { anno, mese } of target) {
    const meseAnnoStr = `${anno}-${String(mese).padStart(2, "0")}-01`;
    try {
      const pun = await fetchPUNMensile(anno, mese);
      await upsertIndice("PUN", meseAnnoStr, pun);
      results.push(`PUN ${meseAnnoStr}: ${pun} €/kWh`);
    } catch (e) { errors.push(`PUN ${meseAnnoStr}: ${e.message}`); }
    try {
      const psv = await fetchPSVMensile(anno, mese);
      await upsertIndice("PSV", meseAnnoStr, psv);
      results.push(`PSV ${meseAnnoStr}: ${psv} €/Smc`);
    } catch (e) { errors.push(`PSV ${meseAnnoStr}: ${e.message}`); }
  }

  console.log("[update-indici] results:", results);
  if (errors.length) console.warn("[update-indici] errors:", errors);
  return res.status(200).json({ ok: errors.length === 0, updated: results, errors, timestamp: now.toISOString() });
}
