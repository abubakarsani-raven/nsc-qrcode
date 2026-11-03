"use client";

import NextLink from "next/link";
import Button, { type ButtonProps } from "@mui/material/Button";

/** MUI button that navigates client-side (usable from server components). */
export function LinkButton({ href, ...props }: ButtonProps & { href: string }) {
  return <Button component={NextLink} href={href} {...props} />;
}
