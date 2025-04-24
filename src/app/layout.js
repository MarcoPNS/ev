import * as React from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Image from 'next/image';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "EV Charging Providers",
  description: "A list of EV charging providers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div id="app-root">
          <CssBaseline />
          <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Toolbar sx={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2 }}>
              <Link href="https://camefrom.space" underline="none" sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                  <Image src="/camefromspace-logo.svg" alt="camefromspace Logo" width={93} height={43} priority />
                </Box>
              </Link>
              <Typography variant="h6" color="text.secondary" sx={{ ml: 2, fontWeight: 400, flexGrow: 1 }}>
                EV Charging Comparison
              </Typography>
            </Toolbar>
          </AppBar>
          <Container maxWidth="lg" disableGutters>
            {children}
          </Container>
          <Box component="footer" sx={{ mt: 5, py: 3, textAlign: 'center', fontSize: 13, color: '#888', bgcolor: '#fafbfc' }}>
            <Typography variant="body2" color="text.secondary">
              Alle Preise können sich ändern. Es wird keine Gewähr für die Richtigkeit und Aktualität der Angaben übernommen.
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Link href="/imprint" sx={{ mr: 2 }}>Impressum</Link>
              <Link href="/privacy">Datenschutz</Link>
            </Box>
          </Box>
        </div>
      </body>
    </html>
  );
}
