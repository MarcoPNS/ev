"use client";
import * as React from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

export default function ProviderForm({ params, setParams, filters, setFilters, allNetworks }) {
  return (
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
  );
}
