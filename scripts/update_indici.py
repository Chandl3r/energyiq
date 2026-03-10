"""
update_indici.py
Chiama l'API dell'app mobile GME (stessa usata da Home Assistant / mercati-energetici)
per ottenere PUN (luce, €/kWh) e PSV (gas, €/Smc) e li salva su Supabase.

Endpoint GME app:
  Elettricità: GET https://gme.mercatoelettrico.org/DesktopModules/GmePublic/api/MW/GetPrezziMGP?Data=YYYYMMDD
  Gas:         GET https://gme.mercatoelettrico.org/DesktopModules/GmePublic/api/gas/GetPrezziMGP?Data=YYYY-MM-DD

Variabili d'ambiente necessarie:
  SUPABASE_URL          es. https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY  chiave service_role da Supabase → Settings → API
"""

import asyncio
import aiohttp
import os
import json
from datetime import date, timedelta

SUPABASE_URL        = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

GME_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    "Accept": "application/json",
}

# ─── Fetch PUN (luce) ─────────────────────────────────────────────────────────

async def fetch_pun_giorno(session: aiohttp.ClientSession, d: date) -> float | None:
    """Ritorna il PUN medio giornaliero in €/MWh, None se non disponibile."""
    url = (
        "https://gme.mercatoelettrico.org/DesktopModules/GmePublic/api/MW/"
        f"GetPrezziMGP?Data={d.strftime('%Y%m%d')}"
    )
    async with session.get(url, headers=GME_HEADERS, timeout=aiohttp.ClientTimeout(total=15)) as r:
        if r.status != 200:
            print(f"  PUN {d}: HTTP {r.status}")
            return None
        data = await r.json(content_type=None)
        # Risposta: [{"Ora":1,"PUN":131.77,...}, ...]  oppure lista vuota
        if not data:
            print(f"  PUN {d}: risposta vuota")
            return None
        valori = [float(row["PUN"]) for row in data if row.get("PUN") is not None]
        if not valori:
            return None
        return sum(valori) / len(valori)  # media oraria = PUN medio giornaliero

async def fetch_pun_mensile(session: aiohttp.ClientSession, anno: int, mese: int) -> float | None:
    """Media PUN degli ultimi giorni del mese (max 5 tentativi), in €/kWh."""
    # Parte dall'ultimo giorno del mese, scorre a ritroso
    import calendar
    ultimo = date(anno, mese, calendar.monthrange(anno, mese)[1])
    oggi   = date.today()
    valori = []
    for i in range(7):  # prova 7 giorni per robustezza
        d = ultimo - timedelta(days=i)
        if d > oggi:
            continue
        v = await fetch_pun_giorno(session, d)
        if v is not None:
            valori.append(v)
        if len(valori) >= 3:  # 3 giorni bastano per una buona media
            break
    if not valori:
        return None
    media_mwh = sum(valori) / len(valori)
    return round(media_mwh / 1000, 5)  # €/kWh, 5 decimali

# ─── Fetch PSV (gas) ──────────────────────────────────────────────────────────

async def fetch_psv_giorno(session: aiohttp.ClientSession, d: date) -> float | None:
    """Ritorna il PSV medio giornaliero in €/MWh, None se non disponibile."""
    url = (
        "https://gme.mercatoelettrico.org/DesktopModules/GmePublic/api/gas/"
        f"GetPrezziMGP?Data={d.isoformat()}"  # formato YYYY-MM-DD per il gas
    )
    async with session.get(url, headers=GME_HEADERS, timeout=aiohttp.ClientTimeout(total=15)) as r:
        if r.status != 200:
            print(f"  PSV {d}: HTTP {r.status}")
            return None
        data = await r.json(content_type=None)
        # Risposta: [{"Data":"...","PSV":51.99,...}, ...]
        if not data:
            print(f"  PSV {d}: risposta vuota")
            return None
        valori = []
        for row in data:
            v = row.get("PSV") or row.get("PrezzoMedio") or row.get("prezzoMedio")
            if v is not None:
                valori.append(float(v))
        if not valori:
            return None
        return sum(valori) / len(valori)

async def fetch_psv_mensile(session: aiohttp.ClientSession, anno: int, mese: int) -> float | None:
    """Media PSV degli ultimi giorni del mese, convertita in €/Smc."""
    import calendar
    ultimo = date(anno, mese, calendar.monthrange(anno, mese)[1])
    oggi   = date.today()
    valori = []
    for i in range(7):
        d = ultimo - timedelta(days=i)
        if d > oggi:
            continue
        v = await fetch_psv_giorno(session, d)
        if v is not None:
            valori.append(v)
        if len(valori) >= 3:
            break
    if not valori:
        return None
    media_mwh = sum(valori) / len(valori)
    # €/MWh ÷ 93.54 = €/Smc  (potere calorifico superiore standard ARERA)
    return round(media_mwh / 93.54, 5)

# ─── Supabase upsert ──────────────────────────────────────────────────────────

async def upsert_indice(session: aiohttp.ClientSession, tipo: str, mese_anno: str, valore: float):
    url = f"{SUPABASE_URL}/rest/v1/indici_mercato"
    payload = {
        "tipo_indice":  tipo,
        "mese_anno":    mese_anno,
        "valore_medio": valore,
        "fonte":        "GME",
    }
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Prefer": "resolution=merge-duplicates",
    }
    async with session.post(url, json=payload, headers=headers) as r:
        if r.status not in (200, 201):
            txt = await r.text()
            raise RuntimeError(f"Supabase upsert {tipo} fallito ({r.status}): {txt}")

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    oggi  = date.today()
    # Aggiorna mese precedente (dati definitivi) + mese corrente (dati parziali)
    target = [
        (oggi.year if oggi.month > 1 else oggi.year - 1,
         oggi.month - 1 if oggi.month > 1 else 12),
        (oggi.year, oggi.month),
    ]

    async with aiohttp.ClientSession() as session:
        for anno, mese in target:
            mese_str = f"{anno}-{mese:02d}-01"
            print(f"\n── {anno}-{mese:02d} ──")

            pun = await fetch_pun_mensile(session, anno, mese)
            if pun:
                await upsert_indice(session, "PUN", mese_str, pun)
                print(f"  ✅ PUN = {pun} €/kWh")
            else:
                print(f"  ⚠️  PUN non disponibile")

            psv = await fetch_psv_mensile(session, anno, mese)
            if psv:
                await upsert_indice(session, "PSV", mese_str, psv)
                print(f"  ✅ PSV = {psv} €/Smc")
            else:
                print(f"  ⚠️  PSV non disponibile")

    print("\nDone.")

if __name__ == "__main__":
    asyncio.run(main())
