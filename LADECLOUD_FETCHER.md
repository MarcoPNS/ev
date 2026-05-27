# Ladecloud-Fetcher & Mapper Dokumentation

## Überblick

Der `fetch-ladecloud.mjs` Script automatisiert den Import von öffentlichen Ladenetz-Provider-Daten aus der Ladecloud-API und wandelt sie in das standardisierte Provider-JSON-Format um.

## API-Quellen

### 1. Provider-List Endpoint
**URL**: `https://backend.ladecloud.de/ladeapp-api/api/v1/providers`

**Pagination**: 
- Parameter: `page` (Seitennummer, 0-indexed) und `pageSize` (Standard: 30)
- Example: `...?page=0&pageSize=30`
- Response enthält `hasNext: boolean` zum Durchlaufen aller Seiten
- Der Fetcher durchläuft automatisch alle Seiten

Liefert eine Liste aller verfügbaren Provider/Betreiber mit Metadaten.

```json
{
  "data": [
    {
      "id": "3d09dc89-0394-463e-9d6e-eb07dd3bf1be",
      "name": "17er Oberlandenergie",
      "address": { ... },
      "contact": { ... },
      "legalDocuments": { ... }
    }
  ]
}
```

### 2. Contract Offers Endpoint
**URL**: `https://backend.ladecloud.de/ladeapp-api/api/v1/contract-offers/public?providerId=<id>`

Liefert eine Liste aller Contract Offers für einen Provider, mit Tarifdetails.

```json
{
  "data": [
    {
      "id": "8d9b0248-2f88-449d-93b3-4e9399051076",
      "contractOfferName": "17er Autostrom",
      "monthlyCardBaseFee": { "value": "6.90" },
      "cardOrderFee": { "value": "9.99" },
      "tariffsPreview": [
        {
          "name": "Tarif AC/DC ladenetz.de Verbund",
          "type": "BASIC",
          "componentsPreview": [
            { "currentType": "AC", "unrestrictedGrossEnergyPrice": { "value": "0.49" } },
            { "currentType": "DC", "unrestrictedGrossEnergyPrice": { "value": "0.67" } }
          ]
        },
        {
          "name": "Tarif AC/DC Roaming",
          "type": "NETWORK",
          "componentsPreview": [
            { "currentType": "AC", "unrestrictedGrossEnergyPrice": { "value": "0.49" } },
            { "currentType": "DC", "unrestrictedGrossEnergyPrice": { "value": "0.67" } }
          ]
        }
      ]
    }
  ]
}
```

## Mapping-Logik

### Tariff-Auswahl

Die Logik wählt automatisch die relevanten Tariffe aus der `tariffsPreview`-Liste:

1. **Ladenetz Verbund** (Normale Betreiber-Preise):
   - Sucht Tariff mit `type: "BASIC"`, ODER
   - Sucht Tariff mit `type: "NETWORK"` und Namen mit "ladenetz.de Verbund"
   - Wird zu `acPrice` und `dcPrice`

2. **Roaming** (Netzwerk-übergreifend):
   - Sucht Tariff mit "Roaming" im Namen
   - Wird zu `acRoamingPrice` und `dcRoamingPrice`
   - Ist optional (kann `null` sein)

### Preise-Extraktion

Aus `componentsPreview` wird für jeden `currentType` ("AC", "DC") der `unrestrictedGrossEnergyPrice.value` extrahiert.

```javascript
const acPrice = 0.49;  // AC-Preis aus ladenetz.de Verbund
const dcPrice = 0.67;  // DC-Preis aus ladenetz.de Verbund
```

### Gebühren-Extraktion

- `basicFee`: Aus `monthlyCardBaseFee` oder `firstCardStartingMonthlyCardFee`
- `cardOrderFee`: Wird in `comment` als "Ladekarte einmalig X€" notiert

## Output-Format

Jedes gemappte Contract Offer wird als Provider-JSON gespeichert:

```json
{
  "name": "ladenetz.de / 17er Autostrom",
  "acPrice": 0.49,
  "dcPrice": 0.67,
  "acRoamingPrice": 0.49,
  "dcRoamingPrice": 0.67,
  "basicFee": 6.9,
  "supportedNetworks": ["ladenetz.de"],
  "chargingStations": 800000,
  "country": "DE",
  "footnote": "Automatisch importiert am 27.5.2026",
  "comment": "Ladekarte einmalig 9.99€.",
  "link": "https://17er.ladecloud.de/contract",
  "isAffiliate": false,
  "hidden": false,
  "sourceProviderId": "3d09dc89-0394-463e-9d6e-eb07dd3bf1be"
}
```

### Dateinamen
- Format: `ladenetz-[contract-offer-name].json`
- Beispiel: `ladenetz-17er-autostrom.json`
- Bereinigung: Umlaute, Sonderzeichen → Bindestriche

## Verzeichnisstruktur

### providers/ (Root - wird vom App-Loader gelesen)
```
providers/
├── ladenetz-17er-autostrom.json        (gemappt, fertig zur Nutzung)
├── ladenetz-komfort.json               (gemappt, fertig zur Nutzung)
├── aldi-sued.json                      (manuell)
└── ...
```

### providers/ladecloud/ (Raw-Datensammlung)
```
providers/ladecloud/
├── index.json                          (Zusammenfassung aller Imports)
├── providers/
│   ├── 3d09dc89-0394-463e-9d6e-eb07dd3bf1be.json  (Raw-Bundle)
│   └── ...
```

## Fehlerbehandlung

Das Skript sammelt detaillierte Fehlerinformationen:

### Response-Codes
- **200 OK** - Erfolgreich
- **401** - Authentifizierung fehlgeschlagen (API-Key ungültig/abgelaufen)
- **404** - Provider oder Endpoint nicht gefunden
- **429** - Rate Limit überschritten (zu viele Requests in kurzer Zeit)
- **500** - Server Error (Backend-Problem)

### Fehlertypen

1. **Rate Limiting (HTTP 429)**
   - Das Skript warnt: `RATE_LIMIT_HIT`
   - Empfehlung: Request-Verzögerungen zwischen API-Calls hinzufügen
   - Mögliche Ursache: Zu viele Provider zu schnell abrufen

2. **Missing Contract Offers (HTTP 500)**
   - Normalerweise bedeutet dies, der Provider hat keine öffentlichen Angebote
   - Das ist OK und kein Fehler des Imports

3. **No ladenetz.de Verbund Tariff**
   - Contract Offer hat keine Standardtarife
   - Warnung wird geloggt, Provider wird übersprungen

4. **Authentication (HTTP 401)**
   - API-Key ist ungültig oder abgelaufen
   - Prüfen Sie die `.env`-Datei

### Debug-Output

Während der Ausführung werden angezeigt:
```
  Page 0: 30 providers loaded
  Page 1: 30 providers loaded
  [1/100] Provider Name: 5 contract offers found
  [2/100] Another Provider: ERROR: HTTP 500 - Server Error
```

Am Ende:
```
SUMMARY
======
Total providers fetched: 85/100
success: 85
failed:  15
mapped:  127 provider JSONs created
```

## Env-Variablen

```bash
LADECLOUD_API_KEY=dein-api-key
# oder
X_API_KEY=dein-api-key
```

Wird aus folgenden Dateien geladen (in dieser Reihenfolge):
1. `.env`
2. `.env.${NODE_ENV}` (z.B. `.env.development`)
3. `.env.local`
4. `.env.${NODE_ENV}.local` (z.B. `.env.development.local`)

## CLI-Optionen

```bash
node scripts/fetch-ladecloud.mjs [options]

-h, --help                   Zeigt diese Hilfe
-k, --api-key <key>          API-Key direkt übergeben
    --base-url <url>         Basis-URL (Default: https://backend.ladecloud.de/ladeapp-api/api/v1)
    --providers-url <url>    Vollständige Providers-URL
    --contract-offers-url    Vollständige Contract-Offers-URL
-o, --output-dir <path>      Zielordner für Raw-Bundles (Default: providers/ladecloud)
```

## Testing

```bash
node scripts/test-ladecloud-mapper.mjs
```

Validiert die Mapping-Logik mit Beispieldaten aus `EXAMPLE_LADECLOUD.md`.



