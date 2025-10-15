"use client";
import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
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
import Button from "@mui/material/Button";

export default function ProviderTable({ sortedResults, setCommentPopup, commentPopup }) {
    function safePrice(val) {
        return typeof val === 'number' && isFinite(val) ? val : 0;
    }

    return (
        <>
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
                {sortedResults.map((r) => r.footnote && (
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
        </>
    );
}
