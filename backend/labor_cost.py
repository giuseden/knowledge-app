"""
Motore di calcolo del costo del lavoro.

Le formule qui sotto sono deterministiche (nessun calcolo delegato all'LLM):
l'estrazione dei parametri specifici del CCNL/lavoratore avviene via Claude
(vedi extract_labor_cost_params in main.py), ma il calcolo finale è codice
puro, per evitare errori aritmetici da parte del modello.

ATTENZIONE: le aliquote in STANDARD_RATES sono valori indicativi/placeholder.
Vanno verificate e aggiornate periodicamente su fonti ufficiali (INPS,
Agenzia delle Entrate, INAIL) prima di usarle in produzione con clienti
reali. Vedi anche docs/logica-calcolo-costo-lavoro.md per la spiegazione
completa della metodologia e dei limiti.
"""

STANDARD_RATES = {
    # Placeholder — l'aliquota INPS a carico azienda varia tipicamente 29%-32%
    # in base a settore, dimensione azienda ed eventuali agevolazioni attive.
    "inps_azienda_pct": 0.30,
    # Placeholder — l'INAIL dipende dal codice tariffa specifico dell'attività
    # svolta (da ~0.4% a oltre 8%). Non esiste un valore standard unico.
    "inail_pct": 0.005,
    # Aliquota INPS a carico lavoratore dipendente privato (standard).
    "inps_dipendente_pct": 0.0919,
    # Divisore per l'accantonamento TFR annuo.
    "tfr_divisor": 13.5,
    # Scaglioni IRPEF: lista di (soglia_superiore, aliquota). Placeholder —
    # verificare gli scaglioni correnti prima dell'uso.
    "irpef_brackets": [
        (28000.0, 0.23),
        (50000.0, 0.35),
        (float("inf"), 0.43),
    ],
}


def calculate_tfr(ral_utile: float, divisor: float = STANDARD_RATES["tfr_divisor"]) -> float:
    return round(ral_utile / divisor, 2)


def calculate_inps_azienda(ral: float, rate: float = STANDARD_RATES["inps_azienda_pct"]) -> float:
    return round(ral * rate, 2)


def calculate_inail(ral: float, rate: float = STANDARD_RATES["inail_pct"]) -> float:
    return round(ral * rate, 2)


def calculate_irpef_lorda(imponibile: float, brackets=None) -> float:
    brackets = brackets or STANDARD_RATES["irpef_brackets"]
    tax = 0.0
    lower = 0.0
    for threshold, rate in brackets:
        taxable_in_bracket = max(0.0, min(imponibile, threshold) - lower)
        tax += taxable_in_bracket * rate
        lower = threshold
        if imponibile <= threshold:
            break
    return round(tax, 2)


def calculate_labor_cost(params: dict) -> dict:
    """
    params attesi (estratti da CCNL/messaggio utente):
      - ral: float, obbligatorio — Retribuzione Annua Lorda
      - inps_azienda_pct: float, opzionale — override aliquota INPS azienda
      - inail_pct: float, opzionale — override aliquota INAIL
    """
    ral = float(params["ral"])
    inps_rate = params.get("inps_azienda_pct") or STANDARD_RATES["inps_azienda_pct"]
    inail_rate = params.get("inail_pct") or STANDARD_RATES["inail_pct"]

    contributi_inps = calculate_inps_azienda(ral, inps_rate)
    inail = calculate_inail(ral, inail_rate)
    tfr = calculate_tfr(ral)
    costo_annuo = ral + contributi_inps + inail + tfr

    return {
        "ral": round(ral, 2),
        "contributi_inps_azienda": contributi_inps,
        "inail": inail,
        "tfr_accantonamento": tfr,
        "costo_annuo_azienda": round(costo_annuo, 2),
        "costo_mensile_azienda": round(costo_annuo / 12, 2),
        "aliquote_usate": {"inps_azienda_pct": inps_rate, "inail_pct": inail_rate},
    }
