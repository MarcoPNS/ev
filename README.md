# EV Charging Price Comparison

Ein Open-Source Next.js-Projekt zum Vergleich von Ladetarifen verschiedener E-Auto-Ladeanbieter.

## Features

- Vergleich von AC/DC-Ladepreisen, Roaming-Preisen, Grundgebühren und mehr
- Flexible Filter: Roaming, Grundgebühr, unterstützte Netzwerke
- Interaktive Eingabe: km/Monat, Verbrauch, AC/DC-Anteil, Roaming-Anteil
- Dynamisches Preisdiagramm und detaillierte Ergebnistabelle
- Provider-Profile als JSON-Dateien im `providers/`-Ordner
- Responsive UI mit [MUI](https://mui.com/)
- Datenschutz- und Impressum-Seiten
- Branding für [camefrom.space](https://camefrom.space)

## Schnellstart

1. Repository klonen und Abhängigkeiten installieren:

```bash
npm install
```

2. Entwicklungsserver starten:

```bash
npm run dev
```

3. Im Browser öffnen: [http://localhost:3000](http://localhost:3000)

## Provider hinzufügen

Lege im Ordner `providers/` eine neue `.json`-Datei an, z.B. `mein-anbieter.json`:

```json
{
  "name": "Mein Anbieter",
  "acPrice": 0.39,
  "dcPrice": 0.49,
  "acRoamingPrice": 0.45,
  "dcRoamingPrice": 0.55,
  "basicFee": 4.99,
  "supportedNetworks": ["EnBW", "IONITY"],
  "chargingStations": 12000,
  "country": "Deutschland",
  "footnote": "Preise Stand 04/2025",
  "comment": "Günstig bei AC, solide bei DC.",
  "link": "https://anbieter.de",
  "isAffiliate": false,
  "hidden": false
}
```

## Ladenetz-Provider automatisch importieren

Für die Ladecloud-/Ladenetz-Profile gibt es einen Node-CLI-Import, der zuerst die Provider-Liste und danach pro `providerId` die Public Contract Offers lädt, diese in das Provider-Format mapped und direkt als JSON-Dateien speichert.

### Workflow

1. **Fetch Providers (paginiert)**: Lädt alle Seiten automatisch
   - `backend.ladecloud.de/ladeapp-api/api/v1/providers?page=0&pageSize=30`
   - Durchläuft alle Seiten bis `hasNext: false`
2. **Fetch pro Provider**: `backend.ladecloud.de/ladeapp-api/api/v1/contract-offers/public?providerId=<id>`
3. **Mapping**: Aus jedem Contract Offer werden automatisch Provider-JSONs generiert:
   - Ladenetz Verbund (Typ `BASIC` oder `NETWORK` mit „ladenetz.de Verbund") → `acPrice`, `dcPrice`
   - Roaming (Typ `NETWORK` mit „Roaming") → `acRoamingPrice`, `dcRoamingPrice`
   - Grundgebühr → `basicFee` (aus `monthlyCardBaseFee`)
   - Kartengebühr → wird in `comment` notiert
4. **Output**:
   - Gemappte Provider-JSONs → `providers/` (automatisch geladen)
   - Raw-Daten & Bundles → `providers/ladecloud/` (für Debugging)

### Nutzung

1. API-Key in einer Env-Datei setzen, z.B. `.env`:

```bash
LADECLOUD_API_KEY=dein-api-key
```

2. Import starten:

```bash
npm run fetch:ladecloud
```

Die neu erstellten oder aktualisierten Provider-JSONs landen automatisch im `providers/` Ordner und werden vom Preisvergleich direkt geladen.

### Debugging & Troubleshooting

Das Skript bietet detailliertes Logging:

- **Success Summary**: Zeigt erfolgreiche/fehlgeschlagene Provider
- **HTTP Error Codes**: Zeigt welche Provider welche Fehler hatten
- **Rate Limiting Detection**: Warnt bei HTTP 429 und empfiehlt Maßnahmen
- **Server Errors**: Hilft zu unterscheiden zwischen API-Problemen und fehlenden Angeboten

Typische Fehlerquellen:
- **HTTP 429** = API Rate Limit erreicht (zu viele Requests)
- **HTTP 401** = API Key ungültig oder abgelaufen
- **HTTP 500** = Server Error (Provider hat wahrscheinlich keine öffentlichen Angebote)
- **"No ladenetz.de Verbund tariff found"** = Provider ohne Standardtarif

Optional kannst du auch direkt Parameter übergeben:

```bash
node scripts/fetch-ladecloud.mjs --api-key dein-api-key --output-dir providers/ladecloud
```


## Rechtliches

Alle Preise können sich ändern. Es wird keine Gewähr für die Richtigkeit und Aktualität der Angaben übernommen. Siehe auch [Impressum](/imprint) und [Datenschutz](/privacy).

---

**Mitmachen & Feedback:**

Pull Requests, Issues und neue Provider-Profile sind willkommen!

---

(c) {new Date().getFullYear()} camefrom.space
