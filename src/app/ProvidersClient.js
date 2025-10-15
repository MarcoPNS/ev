"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ProviderForm from "../components/ProviderForm";
import ProviderChart from "../components/ProviderChart";
import ProviderTable from "../components/ProviderTable";

export default function ProvidersClient({ providers }) {
    const [mounted, setMounted] = useState(false);
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
        setMounted(true);
        const saved = localStorage.getItem("ev_params");
        if (saved) setParams(JSON.parse(saved));
        const savedFilters = localStorage.getItem("ev_filters");
        if (savedFilters) setFilters(JSON.parse(savedFilters));
      }, []);
      
      useEffect(() => {
        if (mounted) {
          localStorage.setItem("ev_params", JSON.stringify(params));
        }
      }, [params, mounted]);
      useEffect(() => {
        if (mounted) {
          localStorage.setItem("ev_filters", JSON.stringify(filters));
        }
      }, [filters, mounted]);
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
        <ProviderForm
            params={params}
            setParams={setParams}
            filters={filters}
            setFilters={setFilters}
            allNetworks={allNetworks}
        />
        <ProviderChart chartData={chartData} />
        <ProviderTable
            sortedResults={sortedResults}
            setCommentPopup={setCommentPopup}
            commentPopup={commentPopup}
        />
    </Box>
  );
}
