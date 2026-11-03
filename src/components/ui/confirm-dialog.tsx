"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { toast } from "sonner";
import { networkMessage } from "@/lib/client-api";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** If set, user must type this exact string to enable confirm */
  requireText?: string;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  requireText,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const canConfirm = !requireText || typed === requireText;

  function close() {
    if (busy) return;
    setTyped("");
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
      setTyped("");
      onOpenChange(false);
    } catch (err) {
      // Keep the dialog open so the user can retry or cancel.
      toast.error(networkMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
        {requireText ? (
          <TextField
            sx={{ mt: 2.5 }}
            label={
              <>
                Type{" "}
                <Box component="span" sx={{ fontFamily: "monospace" }}>
                  {requireText}
                </Box>{" "}
                to confirm
              </>
            }
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            disabled={busy}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm && !busy) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          />
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="text" disabled={busy} onClick={close}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={destructive ? "error" : "primary"}
          disabled={!canConfirm || busy}
          onClick={handleConfirm}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
