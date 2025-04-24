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


## Rechtliches

Alle Preise können sich ändern. Es wird keine Gewähr für die Richtigkeit und Aktualität der Angaben übernommen. Siehe auch [Impressum](/imprint) und [Datenschutz](/privacy).

---

**Mitmachen & Feedback:**

Pull Requests, Issues und neue Provider-Profile sind willkommen!

---

(c) {new Date().getFullYear()} camefrom.space
