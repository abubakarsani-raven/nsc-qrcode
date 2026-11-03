"use client";

import { ThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/theme/mui-theme";

export function MuiProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>;
}
