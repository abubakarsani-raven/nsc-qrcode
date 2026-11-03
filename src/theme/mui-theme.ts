"use client";

import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

/**
 * MUI theme built from the same Material 3 roles as globals.css (`--md-*`),
 * so MUI components and the existing token-styled chrome read as one system.
 * Hex values are duplicated here because MUI derives hover / disabled shades
 * from them and cannot do that from a CSS variable.
 */
const md = {
  primary: "#1b3a6b",
  onPrimary: "#ffffff",
  primaryContainer: "#d8e2fa",
  onPrimaryContainer: "#0a1d3c",
  secondary: "#4f5b6b",
  secondaryContainer: "#dce3ec",
  onSecondaryContainer: "#131c27",
  tertiary: "#0e7490",
  warning: "#b4530c",
  warningContainer: "#fbe2ce",
  onWarningContainer: "#2e1400",
  error: "#9a2420",
  errorContainer: "#f8dedc",
  onErrorContainer: "#3a0906",
  surface: "#f5f6f8",
  surfaceLowest: "#ffffff",
  surfaceLow: "#eff1f5",
  surfaceContainer: "#e8eaee",
  surfaceHigh: "#e1e5eb",
  onSurface: "#1a1c21",
  onSurfaceVariant: "#565d69",
  outline: "#767d89",
  outlineVariant: "#c6cbd4",
};

const body = '"Roboto", ui-sans-serif, system-ui, sans-serif';
const condensed = '"Roboto Condensed", "Roboto", ui-sans-serif, sans-serif';
const mono = '"Roboto Mono", ui-monospace, monospace';

export const muiTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: md.primary, contrastText: md.onPrimary },
    secondary: { main: md.tertiary, contrastText: "#ffffff" },
    warning: { main: md.warning, contrastText: "#ffffff" },
    error: { main: md.error, contrastText: "#ffffff" },
    success: { main: "#1f6b3a", contrastText: "#ffffff" },
    info: { main: md.tertiary, contrastText: "#ffffff" },
    background: { default: md.surface, paper: md.surfaceLowest },
    text: { primary: md.onSurface, secondary: md.onSurfaceVariant },
    divider: md.outlineVariant,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: body,
    button: { textTransform: "none", fontWeight: 500, letterSpacing: "0.006em" },
    overline: { fontFamily: condensed, fontWeight: 600, letterSpacing: "0.08em" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 20, minHeight: 40 },
        sizeSmall: { minHeight: 32, paddingInline: 14 },
        outlined: { borderColor: md.outline },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 999 } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        outlined: { borderColor: md.outlineVariant },
      },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: 16 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small", fullWidth: true },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: md.surfaceLowest,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: md.outline },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          borderColor: md.outline,
          color: md.onSurfaceVariant,
          "&.Mui-selected": {
            backgroundColor: md.secondaryContainer,
            color: md.onSecondaryContainer,
          },
          "&.Mui-selected:hover": { backgroundColor: "#cdd6e1" },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          variants: [
            {
              props: { variant: "standard", severity: "warning" },
              style: { backgroundColor: md.warningContainer, color: md.onWarningContainer },
            },
            {
              props: { variant: "standard", severity: "error" },
              style: { backgroundColor: md.errorContainer, color: md.onErrorContainer },
            },
          ],
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 28 } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: 24, fontWeight: 400, paddingTop: 24 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: "none",
          backgroundColor: md.surfaceLowest,
          "--DataGrid-rowBorderColor": md.surfaceHigh,
          "--DataGrid-containerBackground": md.surfaceLow,
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
          "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within": {
            outline: "none",
          },
        },
        columnHeaderTitle: {
          fontFamily: condensed,
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: md.onSurfaceVariant,
        },
        row: {
          "&:hover": { backgroundColor: md.surfaceLow },
          "&.Mui-selected": { backgroundColor: md.primaryContainer },
          "&.Mui-selected:hover": { backgroundColor: "#cdd9f5" },
        },
        cell: { display: "flex", alignItems: "center" },
        footerContainer: { borderTopColor: md.surfaceHigh },
      },
    },
  },
});

export const monoFont = mono;
