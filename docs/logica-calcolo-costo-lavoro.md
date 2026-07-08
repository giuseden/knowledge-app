# Logica di calcolo del costo del lavoro — KnowledgeAI

Questo documento spiega come il chatbot di KnowledgeAI stima il costo del
lavoro quando un utente fa una domanda tipo "quanto costa assumere un 3°
livello CCNL Commercio, full-time?". È pensato sia come documentazione
tecnica sia come documento caricabile nella sezione "Documenti di
riferimento" dell'app, così il chatbot può citarlo per spiegare la propria
metodologia.

## Principio generale

Il calcolo **non è delegato interamente all'LLM**. Gli LLM sono inaffidabili
sull'aritmetica precisa, e un errore su questi numeri può costare caro a un
cliente dello studio. Il sistema separa quindi due fasi:

1. **Estrazione dei parametri** (fatta da Claude): legge i documenti CCNL
   caricati e il messaggio dell'utente, ed estrae in formato strutturato i
   dati necessari (RAL, livello, CCNL, mensilità).
2. **Calcolo** (fatto da codice deterministico, `backend/labor_cost.py`):
   applica le formule descritte sotto ai parametri estratti. Nessun numero
   finale è "inventato" dal modello.

## Due categorie di parametri

- **Standard**: uguali per (quasi) tutte le aziende, ma cambiano nel tempo
  per legge/decreto (aliquote INPS, scaglioni IRPEF, ecc.)
- **Personalizzati**: dipendono dal CCNL applicato, dal livello di
  inquadramento, dall'azienda specifica e da eventuali agevolazioni

## Formula generale del costo aziendale

```
Costo annuo azienda ≈ RAL
                     + Contributi INPS a carico azienda
                     + INAIL
                     + Accantonamento TFR
                     (+ eventuali altri costi: welfare, buoni pasto, ecc. — non ancora inclusi)
```

Dove:

```
RAL (Retribuzione Annua Lorda) = Retribuzione tabellare mensile (da CCNL, per livello)
                                  × numero di mensilità (12, 13 o 14 secondo il CCNL)
                                  + scatti di anzianità maturati
                                  + eventuali superminimi/indennità
```

### Contributi INPS a carico azienda

```
Contributi INPS azienda = RAL × aliquota_inps_azienda
```

⚠️ **L'aliquota non è un numero fisso.** Varia tipicamente tra il 29% e il
32% in base a settore, dimensione dell'azienda (sopra/sotto 15 dipendenti) e
agevolazioni contributive eventualmente attive (es. esonero giovani under
36, decontribuzione Sud, ecc.). Il valore nel codice (`STANDARD_RATES` in
`backend/labor_cost.py`) è un **placeholder** e va verificato/aggiornato
periodicamente su fonte ufficiale INPS.

### INAIL

```
INAIL = RAL × tasso_INAIL
```

⚠️ Il tasso dipende dal **codice tariffa INAIL** specifico dell'attività
svolta e può variare da circa 0,4% a oltre l'8%. Non esiste un valore
standard applicabile a tutte le aziende: andrebbe recuperato dalla visura
INAIL dell'azienda cliente o dalle tabelle ufficiali per settore.

### TFR (Trattamento di Fine Rapporto)

```
Accantonamento annuo TFR = Retribuzione utile ai fini TFR / 13,5
```

È un costo differito (accantonamento), non un contributo versato subito,
ma va comunque incluso nel costo aziendale complessivo.

### Costo aziendale totale

```
Costo annuo azienda  ≈ RAL + Contributi INPS azienda + INAIL + TFR
Costo mensile azienda ≈ Costo annuo azienda / 12
```

## Lato dipendente (busta paga netta — non ancora implementato nel calcolo automatico)

Se in futuro servirà anche il netto per il lavoratore:

```
Contributi INPS lavoratore ≈ RAL × 9,19%  (aliquota standard dipendenti privati)
Imponibile fiscale          = RAL − Contributi INPS lavoratore
IRPEF lorda                 = applicazione degli scaglioni progressivi correnti
Netto                       = Imponibile fiscale − IRPEF netta − detrazioni − addizionali regionali/comunali
```

Gli scaglioni IRPEF e le detrazioni per lavoro dipendente cambiano spesso
per decreto e vanno tenuti aggiornati separatamente (vedi sezione limiti).

## Come funziona nel prodotto

1. L'utente chiede nel chatbot, es. *"Quanto costa assumere un 3° livello
   CCNL Commercio, full-time?"*
2. Il backend rileva l'intento di calcolo tramite parole chiave (`costo del
   lavoro`, `quanto costa assumere`, ecc. — vedi `LABOR_COST_KEYWORDS` in
   `backend/main.py`)
3. Claude Haiku legge i chunk di documenti recuperati dal RAG (il CCNL
   caricato) ed estrae i parametri strutturati (RAL, livello, CCNL,
   mensilità) — funzione `extract_labor_cost_params`
4. Il backend applica le formule sopra (`labor_cost.calculate_labor_cost`)
   in modo deterministico
5. Il risultato viene mostrato in chat come scheda riepilogativa
   (`LaborCostCard.tsx`), con il dettaglio di ogni voce e le aliquote usate

## Limiti attuali — cose da NON dare per buone senza verifica

- Le aliquote INPS/INAIL nel codice sono **placeholder indicativi**, non
  valori certificati: vanno confermate da un consulente del lavoro reale
  prima di mostrarle a clienti finali dello studio
- Non gestisce ancora agevolazioni contributive specifiche (under 35, Sud
  Italia, categorie protette, ecc.) — l'utente deve considerarle a parte
- Non gestisce ancora regole speciali per part-time, apprendistato o
  contratti a termine
- Il calcolo del netto in busta paga (lato dipendente) non è ancora
  collegato al chatbot — solo il costo aziendale lo è
- Se nei documenti CCNL caricati manca la retribuzione tabellare del
  livello richiesto, il sistema non genera un calcolo (nessun numero
  inventato) e il chatbot dovrebbe dichiarare l'informazione mancante

## Prossimi passi suggeriti

1. Far verificare le aliquote standard (`backend/labor_cost.py`) da un
   consulente del lavoro reale prima del pilota
2. Caricare CCNL e tabelle contributive aggiornate nella sezione
   "Documenti di riferimento"
3. Aggiungere gestione delle agevolazioni contributive più comuni
4. Valutare se aggiungere anche il calcolo del netto in busta paga
