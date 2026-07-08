# KnowledgeAI — Contesto del Progetto

Documento di briefing per continuare lo sviluppo con Kiro.

---

## Cos'è KnowledgeAI

App SaaS web multi-tenant per studi professionali (commercialisti, consulenti del lavoro) che trasforma le conversazioni e i documenti interni in una knowledge base intelligente consultabile via chatbot AI.

**Tagline:** "La memoria del tuo studio, sempre disponibile"

---

## Problema che risolve

- I collaboratori lasciano lo studio portando via anni di know-how
- L'onboarding di nuovi collaboratori richiede 3-6 mesi
- Il 90% dei processi interni è in testa alle persone, non documentato
- Le stesse domande operative vengono ripetute ogni giorno

---

## Target

**Fase 1 (MVP attuale):** Studi di commercialisti e consulenti del lavoro  
**Fase 2:** PMI e grandi aziende

---

## Funzionalità MVP implementate

1. **Registrazione audio** — direttamente dal browser, senza app da installare
2. **Trascrizione automatica** — OpenAI Whisper API, ottimizzata per italiano
3. **Export Word** — documento .docx scaricabile dopo la trascrizione
4. **Knowledge base con categorie pre-impostate:**
   - Riunioni clienti
   - Procedure interne
   - Aggiornamenti normativi
   - Scadenze e adempimenti
   - Formazione interna
5. **Chatbot AI (RAG)** — risponde solo dai documenti dello studio, citando le fonti
6. **Multi-tenant isolato** — ogni studio ha il suo spazio completamente separato
7. **Generate Infographic** *(aggiunta di recente)* — rileva parole chiave come "infografica", "schema", "mappa", "diagramma" nel messaggio dell'utente, fa una seconda chiamata Claude (Haiku) per estrarre JSON strutturato dal contesto RAG, e renderizza un'infografica visiva nel chatbot con bottone "Scarica PNG"
8. **Subfolder documenti** *(implementato, da deployare)* — separazione documenti in due sezioni con cartelle organizzabili

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (file audio + Word doc) |
| Trascrizione | OpenAI Whisper API |
| AI Chatbot | Anthropic Claude API (Sonnet per chat, Haiku per infografiche) |
| Ricerca semantica | pgvector (embedding vettoriali) |
| Deploy frontend | Vercel |
| Deploy backend | Railway |

---

## Architettura multi-tenant

- Ogni studio è un'**organization** con UUID univoco
- Tutte le tabelle hanno colonna `organization_id`
- **Row Level Security (RLS)** attiva su Supabase — isolamento a livello database, non solo applicativo
- Anche i file in Storage sono isolati per tenant

---

## Struttura cartelle

```
knowledge-app/
├── frontend/               # Next.js 14
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── dashboard/
│   │   ├── upload/
│   │   ├── documents/
│   │   │   ├── page.tsx             # Server component, fetch documents+folders
│   │   │   ├── DocumentsClient.tsx  # Client wrapper con stato selezione folder
│   │   │   ├── FolderSidebar.tsx    # Sidebar cartelle con CRUD inline
│   │   │   ├── DocumentsTable.tsx   # Tabella con sposta-in-cartella
│   │   │   ├── DeleteDocButton.tsx
│   │   │   └── SpreadsheetEditor.tsx
│   │   └── chat/                    # Chatbot principale
│   ├── components/
│   │   └── InfographicRenderer.tsx  # Componente infografiche
│   └── lib/
│       ├── api.ts                   # Client API + folder functions
│       └── supabase/
└── backend/                # FastAPI Python
    └── main.py             # API principale + logica RAG + infografiche + folder endpoints
```

---

## Feature Infographic — dettagli implementazione

**File modificati:**
- `backend/main.py` — aggiunta rilevamento keyword, funzione `extract_infographic_data()`, evento SSE `{"infographic": {...}}`
- `frontend/app/chat/page.tsx` — gestione evento SSE infografica, render componente
- `frontend/components/InfographicRenderer.tsx` — nuovo componente (162 righe)

**Logica backend:**

```python
INFOGRAPHIC_KEYWORDS = [
    "infografica", "infographic", "visualizza", "schema",
    "mappa", "diagramma", "grafico", "rappresenta",
]
```

Dopo la risposta testuale in streaming, se il messaggio contiene keyword, chiama Claude Haiku con il contesto RAG e ottiene JSON strutturato:

```json
{
  "type": "steps|categories|timeline|keypoints",
  "title": "...",
  "items": [{"label": "...", "description": "...", "icon": "emoji"}]
}
```

**Logica frontend (InfographicRenderer.tsx):**
- `steps` → flowchart verticale con cerchi numerati
- `categories` → griglia 2 colonne con card colorate
- `timeline` → timeline orizzontale con dots
- `keypoints` → card statistiche colorate
- Download PNG via `html2canvas`

---

## Feature Subfolder Documenti — dettagli implementazione

### Concetto
I documenti sono separati in due sezioni distinte con cartelle organizzabili:

- **Knowledge Base** — documenti interni dello studio (riunioni, procedure, note)
- **Documenti di riferimento** — CCNL, tabelle contributive INPS, circolari normative

### Database (migration: `supabase/migrations/001_folders.sql`)
- Nuova tabella `folders`: `id`, `organization_id`, `name`, `document_type` (`knowledge`|`reference`), `parent_id`, `created_at` + RLS completa
- Colonne aggiunte a `documents`: `folder_id` (FK → folders), `document_type` (default `knowledge`)
- **⚠️ Da eseguire su Supabase:** SQL Editor → incolla `001_folders.sql` → Run

### Backend (endpoint aggiunti a `main.py`)
- `GET /folders?organization_id=` — lista cartelle
- `POST /folders` — crea cartella (`name`, `document_type`, `organization_id`, `parent_id` opzionale)
- `PATCH /folders/{id}` — rinomina cartella
- `DELETE /folders/{id}` — elimina cartella (i documenti restano nella radice)
- `PATCH /documents/{id}/move` — sposta documento in cartella (`folder_id: null` per radice)

### Frontend
- `FolderSidebar.tsx` — sidebar con sezioni KB e Riferimento, CRUD cartelle inline (crea/rinomina/elimina senza modal)
- `DocumentsClient.tsx` — wrapper client con stato selezione folder/tipo, filtraggio, breadcrumb
- `DocumentsTable.tsx` — aggiornata: bottone FolderInput per spostare documento, badge cartella sotto il titolo
- `upload/page.tsx` — aggiornata: toggle tipo documento + selezione cartella opzionale (filtrata per tipo)
- `lib/api.ts` — aggiunto tipo `Folder` e funzioni `listFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `moveDocument`

---

## Feature Calcolo Costo del Lavoro — strategia pianificata

### Contesto
I consulenti del lavoro devono rispondere rapidamente (anche durante telefonate con clienti) a domande tipo "quanto mi costa assumere un impiegato 3° livello CCNL Commercio?". I tool esistenti (Wolters Kluwer One LAVORO AI, TeamSystem, Zucchetti) sono costosi (€800-3.000+/anno), complessi da configurare e non integrati con la knowledge base dello studio.

### Posizionamento rispetto ai competitor
| | Wolters Kluwer AI | KnowledgeAI |
|---|---|---|
| Focus | Normativa generale (INPS, CCNL, leggi) | Knowledge interna dello studio |
| Dati | Database WK aggiornato | Documenti caricati dallo studio |
| Prezzo | €800-3.000+/anno | TBD |
| Target | Studi medio-grandi | Studi piccoli/medi |
| Setup | Complesso | Immediato |

### Architettura documenti per il calcolo
Non serve un modulo separato. Il chatbot RAG esistente risponde già alle domande di calcolo se i documenti giusti sono caricati:

```
Documenti di sistema (caricati manualmente da noi, sezione "Riferimento")
├── CCNL più comuni (Commercio, Metalmeccanici, Studi Professionali, ecc.)
├── Tabelle contributive INPS anno corrente
└── Aliquote IRPEF anno corrente

Documenti dello studio (caricati dall'utente, sezione "Riferimento")
├── Accordi integrativi aziendali dei loro clienti
└── Note su agevolazioni contributive attive
```

### Strato standard vs personalizzato
**Standard (uguale per tutti):**
- Aliquota contributiva INPS (~30% a carico azienda)
- Aliquota INAIL per settore
- Calcolo TFR (1/13.5 della RAL annua)
- Detrazioni IRPEF per lavoro dipendente

**Personalizzato (varia per azienda/lavoratore):**
- CCNL applicato → livello, scatti, tredicesima, quattordicesima, buoni pasto
- Agevolazioni contributive → zona geografica, età lavoratore, categoria, tipo contratto
- Benefit aziendali
- Sede (addizionali IRAP regionali)

### Strategia aggiornamento documenti normativi
- **Per ora:** caricamento manuale dei PDF una volta all'anno (qualche ora/anno di effort)
- **Futuro:** script che scarica PDF da fonti ufficiali e notifica quando aggiornare
- **Non automatizzare completamente** finché non ci sono utenti paganti che lo richiedono
- CCNL: ~900 in Italia ma uno studio tipicamente usa 10-20; non esiste fonte digitale centralizzata
- Tabelle INPS e aliquote IRPEF: pubblicate annualmente, più semplici da automatizzare

### I dati del singolo lavoratore
I parametri del lavoratore (livello, anzianità, part-time/full-time) sono **parametri della domanda al chatbot**, non documenti caricati. Esempio:
> "Quanto costa assumere Mario Rossi, 3° livello CCNL Commercio, part-time 20h, under 35?"

### Use case specifici per consulenti del lavoro
- Calcolo costo del lavoro in tempo reale durante telefonate con clienti
- Interrogazione CCNL: "quanti giorni di ferie spettano a un operaio metalmeccanico al 3° livello?"
- Lettere disciplinari e contestazioni (art. 7 Statuto Lavoratori)
- Checklist onboarding nuovo dipendente (Unilav, visita medica, documenti)
- Calcolo agevolazioni contributive attive (under 35, Sud Italia, disoccupati lunga durata)
- Procedure CIGO/CIGS/CIG in deroga
- Calcoli maternità, paternità, congedi parentali INPS
- Assistente per ispezioni del lavoro (documentazione in tempo reale)

---

## URL di produzione

- **Frontend:** https://knowledge-app-six.vercel.app
- **Backend:** Railway (auto-deploy da branch `main` su GitHub)

---

## Stato attuale

- ✅ MVP funzionante e deployato
- ✅ Feature infografiche deployata (commit `93ca4b`)
- ✅ Feature subfolder documenti implementata (codice pronto, migration da eseguire su Supabase)
- ⚠️ Da testare in produzione la feature infografiche
- ⚠️ Migration `001_folders.sql` da eseguire su Supabase prima di deployare i subfolder
- ⚠️ Da fare onboarding guidato per il primo accesso
- ⚠️ Gestione errori da migliorare (es. se trascrizione fallisce)
- ⚠️ Pricing page non ancora presente
- 🔜 Pilota reale presso studio familiare
- 🔜 Caricare documenti di riferimento (CCNL, tabelle INPS) per abilitare calcolo costo del lavoro

---

## Note importanti per lo sviluppo

- Il progetto è su **MacBook Air 2018 Intel**, Node v24.15.0
- Cartella progetto: `/Users/giuseppedenicastro/knowledge-app`
- Supabase free tier: va in **pausa dopo 7 giorni di inattività** → riattivare da dashboard prima di lavorare
- Per avviare in locale: `npm run dev` nella cartella `frontend/`
- Il backend FastAPI va avviato separatamente nella cartella `backend/`
- Variabili d'ambiente in `.env.local` (non committate su Git)

---

## Prossimi sviluppi pianificati

1. Eseguire migration `001_folders.sql` su Supabase e deployare feature subfolder
2. Caricare documenti di riferimento (CCNL + tabelle INPS/IRPEF) nella sezione "Documenti di riferimento"
3. Test pilota presso studio familiare e raccolta feedback
4. Onboarding guidato per nuovi utenti
5. Pricing page
6. Miglioramento gestione errori
7. Script di notifica aggiornamento automatico documenti normativi
8. Monitoraggio aggiornamenti normativi italiani (Agenzia delle Entrate, INPS, INAIL) — *idea futura*
9. Marketplace DVR (D.Lgs. 81/08) — *idea futura*
