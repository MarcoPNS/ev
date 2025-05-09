"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CloseIcon from '@mui/icons-material/Close';
import Link from '@mui/material/Link';
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin // Zoom-Plugin registrieren
);

export default function ProvidersClient({ providers }) {
    const [params, setParams] = useState({
        km: 1000,
        kwhPer100km: 15,
        acShare: 60,
        roamingShare: 20,
      });
      const [filters, setFilters] = useState({
        hideNoRoaming: false,
        hideBaseFee: false,
        network: "all"
      });
      
      useEffect(() => {
        const saved = localStorage.getItem("ev_params");
        if (saved) setParams(JSON.parse(saved));
        const savedFilters = localStorage.getItem("ev_filters");
        if (savedFilters) setFilters(JSON.parse(savedFilters));
      }, []);
      
      useEffect(() => {
        localStorage.setItem("ev_params", JSON.stringify(params));
      }, [params]);
      useEffect(() => {
        localStorage.setItem("ev_filters", JSON.stringify(filters));
      }, [filters]);
  const [commentPopup, setCommentPopup] = useState({ open: false, text: "" });
  const [sort, setSort] = useState({ key: "total", dir: "asc" });

  // Alle Netzwerke für Dropdown sammeln
  const allNetworks = Array.from(new Set(
    providers.flatMap(p => p.supportedNetworks || [])
  ));

  function handleSort(key) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }

  function safePrice(val) {
    return typeof val === 'number' && isFinite(val) ? val : 0;
  }
  function calcTotal(p, km) {
    const kWh = (km / 100) * params.kwhPer100km;
    const acRatio = params.acShare / 100;
    const dcRatio = 1 - acRatio;
    // Roaming nur, wenn verfügbar
    const roamingAvailable = p.roamingAvailable !== false && safePrice(p.acRoamingPrice) > 0 && safePrice(p.dcRoamingPrice) > 0;
    const roamingRatio = roamingAvailable ? params.roamingShare / 100 : 0;
    const localRatio = 1 - roamingRatio;
    const acLocal = kWh * acRatio * localRatio;
    const acRoaming = kWh * acRatio * roamingRatio;
    const dcLocal = kWh * dcRatio * localRatio;
    const dcRoaming = kWh * dcRatio * roamingRatio;
    const energyCost =
      acLocal * safePrice(p.acPrice) +
      acRoaming * safePrice(p.acRoamingPrice) +
      dcLocal * safePrice(p.dcPrice) +
      dcRoaming * safePrice(p.dcRoamingPrice);
    return safePrice(p.basicFee) + energyCost;
  }

  // Dynamische kmSteps basierend auf Nutzereingabe
  const maxKm = Math.ceil(params.km * 1.1 / 100) * 100; // auf volle 100 runden
  const step = maxKm > 1000 ? 250 : 100;
  const kmSteps = [];
  for (let k = 0; k <= maxKm; k += step) kmSteps.push(k);

  // Nur sichtbare Provider anzeigen, Filter anwenden
  let visibleProviders = providers.filter(p => !p.hidden);
  if (filters.hideNoRoaming) {
    visibleProviders = visibleProviders.filter(p => (p.roamingAvailable !== false && safePrice(p.acRoamingPrice) > 0 && safePrice(p.dcRoamingPrice) > 0));
  }
  if (filters.hideBaseFee) {
    visibleProviders = visibleProviders.filter(p => safePrice(p.basicFee) === 0);
  }
  if (filters.network !== "all") {
    visibleProviders = visibleProviders.filter(p => (p.supportedNetworks || []).includes(filters.network));
  }
  const results = visibleProviders.map((p) => {
    const totals = kmSteps.map((km) => calcTotal(p, km));
    return {
      name: p.name,
      totals,
      total: calcTotal(p, params.km),
      ...p,
    };
  });
  const chartData = {
    labels: kmSteps,
    datasets: results.map((r, i) => ({
      label: r.name,
      data: r.totals,
      borderColor: `hsl(${i * 60}, 70%, 50%)`,
      fill: false,
    })),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      zoom: {
        zoom: {
          wheel: {
            enabled: true, // Zoom mit dem Mausrad aktivieren
          },
          pinch: {
            enabled: true, // Zoom mit Pinch-Gesten aktivieren
          },
          mode: "x", // Nur horizontal zoomen
        },
        pan: {
          enabled: true, // Verschieben aktivieren
          mode: "x", // Nur horizontal verschieben
        },
      },
    },
  };

  // Sortierfunktion
  function getSortValue(r, key) {
    if (key === "name") return r.name.toLowerCase();
    if (key === "total") return r.total;
    if (key === "basicFee") return r.basicFee;
    if (key === "acPrice") return r.acPrice;
    if (key === "dcPrice") return r.dcPrice;
    if (key === "acRoamingPrice") return r.acRoamingPrice;
    if (key === "dcRoamingPrice") return r.dcRoamingPrice;
    if (key === "chargingStations") return r.chargingStations;
    if (key === "country") return r.country;
    return r[key] || "";
  }
  const sortedResults = [...results].sort((a, b) => {
    const vA = getSortValue(a, sort.key);
    const vB = getSortValue(b, sort.key);
    if (typeof vA === "number" && typeof vB === "number") {
      return sort.dir === "asc" ? vA - vB : vB - vA;
    }
    return sort.dir === "asc"
      ? String(vA).localeCompare(String(vB))
      : String(vB).localeCompare(String(vA));
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ev_params", JSON.stringify(params));
    }
  }, [params]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ev_filters", JSON.stringify(filters));
    }
  }, [filters]);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Typography variant="h3" component="h1" gutterBottom>EV-Ladepreis-Vergleich</Typography>
      <Box component="form" sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4, alignItems: 'center' }}>
        <TextField
          label="km/Monat"
          type="number"
          value={params.km}
          onChange={e => setParams({ ...params, km: +e.target.value })}
          InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }}
          sx={{ width: 120 }}
        />
        <TextField
          label="kWh/100km"
          type="number"
          value={params.kwhPer100km}
          onChange={e => setParams({ ...params, kwhPer100km: +e.target.value })}
          InputProps={{ endAdornment: <InputAdornment position="end">kWh</InputAdornment> }}
          sx={{ width: 120 }}
        />
        <TextField
          label="AC-Anteil (%)"
          type="number"
          value={params.acShare}
          onChange={e => setParams({ ...params, acShare: +e.target.value })}
          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          sx={{ width: 120 }}
        />
        <TextField
          label="Roaming-Anteil (%)"
          type="number"
          value={params.roamingShare}
          onChange={e => setParams({ ...params, roamingShare: +e.target.value })}
          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          sx={{ width: 120 }}
        />
        <FormControlLabel
          control={<Checkbox checked={filters.hideNoRoaming} onChange={e => setFilters(f => ({ ...f, hideNoRoaming: e.target.checked }))} />}
          label="Nur Anbieter mit Roaming"
        />
        <FormControlLabel
          control={<Checkbox checked={filters.hideBaseFee} onChange={e => setFilters(f => ({ ...f, hideBaseFee: e.target.checked }))} />}
          label="Nur Anbieter ohne Grundgebühr"
        />
        <Select
          value={filters.network}
          onChange={e => setFilters(f => ({ ...f, network: e.target.value }))}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">Alle Netzwerke</MenuItem>
          {allNetworks.map(n => (
            <MenuItem key={n} value={n}>{n}</MenuItem>
          ))}
        </Select>
      </Box>
      <Box sx={{ bgcolor: "#fff", p: 2, borderRadius: 2, mb: 4, minHeight: 340 }}>
        <Line data={chartData} options={chartOptions} height={320} />
      </Box>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Anbieter</TableCell>
              <TableCell>Grundgebühr (€)</TableCell>
              <TableCell>AC-Preis</TableCell>
              <TableCell>DC-Preis</TableCell>
              <TableCell>AC Roaming</TableCell>
              <TableCell>DC Roaming</TableCell>
              <TableCell>Netzwerke</TableCell>
              <TableCell>Ladestationen</TableCell>
              <TableCell>Land</TableCell>
              <TableCell>Monatspreis (€)</TableCell>
              <TableCell>Info</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedResults.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.link ? (
                  <Link href={r.link} target="_blank" rel={r.isAffiliate ? "nofollow sponsored" : "noopener noreferrer"} sx={r.isAffiliate ? { color: '#1976d2', fontWeight: 'bold' } : {}}>
                    {r.name}{r.isAffiliate ? ' *' : ''}
                  </Link>
                ) : r.name}</TableCell>
                <TableCell>{safePrice(r.basicFee).toFixed(2)}</TableCell>
                <TableCell>{safePrice(r.acPrice).toFixed(2)}</TableCell>
                <TableCell>{safePrice(r.dcPrice).toFixed(2)}</TableCell>
                <TableCell>{(r.roamingAvailable === false || safePrice(r.acRoamingPrice) === 0) ? 'n.a.' : safePrice(r.acRoamingPrice).toFixed(2)}</TableCell>
                <TableCell>{(r.roamingAvailable === false || safePrice(r.dcRoamingPrice) === 0) ? 'n.a.' : safePrice(r.dcRoamingPrice).toFixed(2)}</TableCell>
                <TableCell>{r.supportedNetworks.join(", ")}</TableCell>
                <TableCell>{r.chargingStations}</TableCell>
                <TableCell>{r.country}</TableCell>
                <TableCell><b>{r.total.toFixed(2)}</b></TableCell>
                <TableCell>
                  {r.comment ? (
                    <IconButton size="small" onClick={() => setCommentPopup({ open: true, text: r.comment })} title="Kommentar anzeigen">
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 2, fontSize: 13, color: '#666' }}>
        {results.map((r) => r.footnote && (
          <div key={r.name + "-footnote"}>{r.name}: {r.footnote}</div>
        ))}
      </Box>
      <Dialog open={commentPopup.open} onClose={() => setCommentPopup({ open: false, text: "" })}>
        <DialogTitle>Info
          <IconButton
            aria-label="close"
            onClick={() => setCommentPopup({ open: false, text: "" })}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography>{commentPopup.text}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentPopup({ open: false, text: "" })} color="primary">Schließen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

