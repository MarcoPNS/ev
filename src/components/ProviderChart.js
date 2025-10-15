"use client";
import * as React from "react";
import Box from "@mui/material/Box";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ProviderChart({ chartData }) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: "x",
        },
        pan: {
          enabled: true,
          mode: "x",
        },
      },
    },
  };

  return (
    <Box sx={{ bgcolor: "#fff", p: 2, borderRadius: 2, mb: 4, minHeight: 340 }}>
      <Line data={chartData} options={chartOptions} height={320} />
    </Box>
  );
}
