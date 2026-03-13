// src/lib/alerts.js
// Calcola gli alert in-app dai dati ARERA e li salva in localStorage.
// Import solo da qui — evita dipendenze circolari con AppShell/ConsumiScreen.

const MESI_S = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function fmtMeseNum(annomese) {
  const s = String(annomese);
  return `${MESI_S[parseInt(s.slice(4)) - 1]} '${s.slice(2, 4)}`;
}

// Calcola consumi mensili gas da letture cumulative (stesso algoritmo di ConsumiScreen)
export function aggGasMensileForAlerts(letture) {
  const byM = new Map();
  for (const l of letture)
    if (!byM.has(l.annomese_riferimento) || l.lettura_smc > byM.get(l.annomese_riferimento).lettura_smc)
      byM.set(l.annomese_riferimento, l);
  const sorted = Array.from(byM.values()).sort((a, b) => a.annomese_riferimento - b.annomese_riferimento);
  return sorted.slice(1).map((r, i) => {
    const diff = r.lettura_smc - sorted[i].lettura_smc;
    return diff >= 0 && diff < 400
      ? { mese: fmtMeseNum(r.annomese_riferimento), smc: Math.round(diff * 10) / 10 }
      : null;
  }).filter(Boolean);
}

export function computeAndSaveAlerts(userId, misure, lettureGas) {
  if (!userId) return;

  const gasBar = aggGasMensileForAlerts(lettureGas || []);
  const alerts = [];

  // ── Luce: ultimo giorno vs media 30gg ───────────────────────────────────────
  if (misure && misure.length > 1) {
    const sorted = [...misure].sort((a, b) => a.data_lettura.localeCompare(b.data_lettura));
    const ultimo = sorted[sorted.length - 1];

    const thirtyBack = new Date(ultimo.data_lettura);
    thirtyBack.setDate(thirtyBack.getDate() - 30);
    const finestra = sorted.filter(m =>
      m.data_lettura >= thirtyBack.toISOString().slice(0, 10) &&
      m.data_lettura <  ultimo.data_lettura
    );
    const media30 = finestra.length
      ? finestra.reduce((s, m) => s + m.totale_kwh, 0) / finestra.length
      : null;

    if (media30 && media30 > 0) {
      const delta = ultimo.totale_kwh - media30;
      const pct   = Math.round((delta / media30) * 100);
      const d     = new Date(ultimo.data_lettura);
      const day   = `${d.getDate()} ${MESI_S[d.getMonth()]}`;
      if (Math.abs(pct) >= 10) {
        const high = delta > 0;
        alerts.push({
          id: "daily_kwh",
          emoji: high ? "⚡" : "✅",
          text: `Il ${day} hai consumato ${ultimo.totale_kwh.toFixed(1)} kWh, ${high ? "+" : ""}${pct}% rispetto alla tua media degli ultimi 30 giorni.${high ? " Era acceso qualcosa di insolito?" : " Ottimo!"}`,
          color: high ? "#ef4444" : "#22c55e",
        });
      }
    }

    // ── Luce: picco settimana ──────────────────────────────────────────────────
    const sevenBack = new Date(ultimo.data_lettura);
    sevenBack.setDate(sevenBack.getDate() - 6);
    const settimana = sorted.filter(m => m.data_lettura >= sevenBack.toISOString().slice(0, 10));
    if (settimana.length >= 3) {
      const peak    = settimana.reduce((b, m) => m.totale_kwh > b.totale_kwh ? m : b);
      const dp      = new Date(peak.data_lettura);
      const DOW     = ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];
      const mediaS  = settimana.reduce((s, m) => s + m.totale_kwh, 0) / settimana.length;
      const pctPeak = Math.round(((peak.totale_kwh - mediaS) / mediaS) * 100);
      if (pctPeak >= 40) {
        alerts.push({
          id: "week_peak",
          emoji: "📈",
          text: `Picco di ${peak.totale_kwh.toFixed(1)} kWh ${DOW[dp.getDay()]} scorso (+${pctPeak}% rispetto alla media settimanale).`,
          color: "#f59e0b",
        });
      }
    }
  }

  // ── Gas: ultimo mese vs precedente ───────────────────────────────────────────
  if (gasBar.length >= 2) {
    const last = gasBar[gasBar.length - 1];
    const prev = gasBar[gasBar.length - 2];
    if (prev.smc > 0) {
      const pct  = Math.round(((last.smc - prev.smc) / prev.smc) * 100);
      if (Math.abs(pct) >= 10) {
        const high = pct > 0;
        alerts.push({
          id: "gas_monthly",
          emoji: high ? "🔥" : "🌿",
          text: `A ${last.mese} hai consumato ${last.smc} Smc di gas, ${high ? "+" : ""}${pct}% rispetto a ${prev.mese}.${!high ? " Continua così!" : ""}`,
          color: high ? "#ef4444" : "#22c55e",
        });
      }
    }
  }

  if (!alerts.length) return;

  try {
    const raw      = localStorage.getItem(`energyiq_alerts_${userId}`);
    const existing = raw ? JSON.parse(raw) : [];
    // Nuovi alert sovrascrivono quelli con stesso id, max 5 totali
    const merged = [
      ...alerts,
      ...existing.filter(e => !alerts.find(a => a.id === e.id)),
    ].slice(0, 5);
    localStorage.setItem(`energyiq_alerts_${userId}`, JSON.stringify(merged));
  } catch { /* noop */ }
}
