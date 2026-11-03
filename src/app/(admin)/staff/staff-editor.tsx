"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadBlob, errorMessage, networkMessage, readJson } from "@/lib/client-api";
import { useRefresh } from "@/lib/use-refresh";
import { RefreshIndicator } from "@/components/refresh-indicator";
import { toast } from "sonner";
import { CardPreview } from "@/components/id-card/CardPreview";
import { TypeScaleControl } from "@/components/id-card/type-scale-control";
import { layoutFront } from "@/lib/id-card/card-layout";
import {
  parseTextSettings,
  serializeTextSettings,
  type CardTextSettings,
} from "@/lib/id-card/type-scale";
import { PhotoCropper, type SavedCrop } from "@/components/photo/PhotoCropper";
import { useLoading } from "@/lib/loading-context";
import { normalizePhoto } from "@/lib/photo/client-resize";
import {
  clampCrop,
  cropDpi,
  cropZoom,
  defaultCrop,
  maxZoom,
  rotatedBounds,
  roundCrop,
  zoomCrop,
  type CardCrop,
  type Size,
} from "@/lib/photo/card-crop";
import { PHOTO_DPI_FLOOR } from "@/lib/id-card/slots.generated";
import {
  FRONT_DEFAULT_BACK,
  brandMismatch,
  frontHasQr,
  nameColorMismatch,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TemplatePicker } from "@/components/id-card/template-picker";
import type { Area } from "react-easy-crop";

type StaffData = {
  id?: string;
  idNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  designation: string;
  posting?: string | null;
  department?: string | null;
  dateIssued?: string | null;
  officeLine?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bloodGroup?: string | null;
  genotype?: string | null;
  frontTemplate: FrontTemplateId;
  backTemplate: BackTemplateId;
  qrToken?: string;
  status?: "ACTIVE" | "SUSPENDED";
  approvalState?: "PENDING" | "APPROVED";
  hasPendingEdits?: boolean;
  photoOriginalKey?: string | null;
  photoPreviewKey?: string | null;
  photoCrop?: string | null;
  cardTypeScale?: string | null;
  lastPrintedAt?: string | null;
  canMedical?: boolean;
  canApprove?: boolean;
  canPrint?: boolean;
  canSuspend?: boolean;
  canQr?: boolean;
};

/** API rows carry full ISO timestamps; the date input needs YYYY-MM-DD. */
function fromServer(staff: Record<string, unknown>): Partial<StaffData> {
  const out = { ...staff } as Partial<StaffData> & Record<string, unknown>;
  if (typeof out.dateIssued === "string") out.dateIssued = out.dateIssued.slice(0, 10);
  // Server-only relations shouldn't leak into form state.
  delete out.published;
  delete out.auditEvents;
  delete out.approvedBy;
  return out;
}

/** Fields whose edits mean the form has unsaved changes. */
const EDITABLE_KEYS = [
  "idNumber",
  "firstName",
  "middleName",
  "lastName",
  "designation",
  "posting",
  "department",
  "dateIssued",
  "officeLine",
  "emergencyContactName",
  "emergencyContactPhone",
  "bloodGroup",
  "genotype",
  "frontTemplate",
  "backTemplate",
] as const;

function snapshot(f: StaffData, text: CardTextSettings) {
  return JSON.stringify([EDITABLE_KEYS.map((k) => f[k] ?? ""), serializeTextSettings(text)]);
}

export function StaffEditor({ initial }: { initial?: StaffData }) {
  const router = useRouter();
  const { refresh, refreshing } = useRefresh();
  const searchParams = useSearchParams();
  const { startLoading, setProgress, stopLoading } = useLoading();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSectionRef = useRef<HTMLDivElement>(null);

  const [textSettings, setTextSettings] = useState<CardTextSettings>(() =>
    parseTextSettings(initial?.cardTypeScale),
  );
  const [form, setForm] = useState<StaffData>(
    initial ?? {
      idNumber: "",
      firstName: "",
      middleName: "",
      lastName: "",
      designation: "",
      frontTemplate: "WAVE_GREEN",
      backTemplate: "BACK_WAVE_GREEN",
      qrToken: "previewtoken0001",
    },
  );
  const [side, setSide] = useState<"front" | "back">("front");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [photoRev, setPhotoRev] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [adjust, setAdjust] = useState<{ src: string; natural: Size; crop: CardCrop } | null>(null);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustSaving, setAdjustSaving] = useState(false);
  /** "recrop" re-cuts the stored original; "new" uploads a newly chosen file. */
  const [cropMode, setCropMode] = useState<"new" | "recrop">("new");
  const [saving, setSaving] = useState(false);
  const previewCardRef = useRef<HTMLDivElement>(null);

  // Unsaved-changes tracking: compare against what the server last confirmed.
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshot(form, parseTextSettings(initial?.cardTypeScale)),
  );
  const dirty = snapshot(form, textSettings) !== savedSnapshot;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mismatch = nameColorMismatch(form.frontTemplate, form.backTemplate);
  const crossBrand = brandMismatch(form.frontTemplate, form.backTemplate);
  const hasQr = frontHasQr(form.frontTemplate);
  const cardLayout = useMemo(
    () =>
      layoutFront({
        frontTemplate: form.frontTemplate,
        firstName: form.firstName || "FIRST",
        middleName: form.middleName,
        lastName: form.lastName || "SURNAME",
        designation: form.designation || "DESIGNATION",
        idNumber: form.idNumber || "0000000000",
        text: textSettings,
      }),
    [
      form.frontTemplate,
      form.firstName,
      form.middleName,
      form.lastName,
      form.designation,
      form.idNumber,
      textSettings,
    ],
  );
  const textOverflow =
    cardLayout.name.overflow || cardLayout.designation.overflow || cardLayout.idNo.overflow;
  const hasPhoto = Boolean(form.photoPreviewKey);
  const isApproved = form.approvalState === "APPROVED" && !form.hasPendingEdits;
  const printable = isApproved && hasPhoto && form.status !== "SUSPENDED";

  const photoUrl = useMemo(() => {
    if (!form.id || !form.photoPreviewKey) return null;
    return `/api/photos/${form.id}/${form.photoPreviewKey}?r=${photoRev}`;
  }, [form.id, form.photoPreviewKey, photoRev]);

  const parsedCrop = useMemo(() => {
    if (!form.photoCrop) return undefined;
    try {
      return JSON.parse(form.photoCrop);
    } catch {
      return undefined;
    }
  }, [form.photoCrop]);

  useEffect(() => {
    if (searchParams.get("photo") !== "1" || !form.id || hasPhoto) return;
    photoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(() => photoInputRef.current?.click(), 450);
    return () => window.clearTimeout(t);
  }, [searchParams, form.id, hasPhoto]);

  function set<K extends keyof StaffData>(key: K, value: StaffData[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "frontTemplate") {
        next.backTemplate = FRONT_DEFAULT_BACK[value as FrontTemplateId];
      }
      return next;
    });
  }

  async function save() {
    if (saving) return; // double-click / Enter-spam guard
    setSaving(true);
    startLoading(form.id ? "Saving changes…" : "Creating staff record…", 5);

    try {
      const payload = {
        idNumber: form.idNumber,
        firstName: form.firstName,
        middleName: form.middleName || null,
        lastName: form.lastName,
        designation: form.designation,
        posting: form.posting || null,
        department: form.department || null,
        dateIssued: form.dateIssued || null,
        officeLine: form.officeLine || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        ...(form.canMedical !== false
          ? { bloodGroup: form.bloodGroup || null, genotype: form.genotype || null }
          : {}),
        frontTemplate: form.frontTemplate,
        backTemplate: form.backTemplate,
        cardTypeScale: serializeTextSettings(textSettings),
      };

      setProgress(30);
      const res = await fetch(form.id ? `/api/staff/${form.id}` : "/api/staff", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setProgress(70);
      const data = await readJson<{ staff?: Record<string, unknown>; unchanged?: boolean }>(res);
      if (!res.ok || !data.staff) {
        toast.error(errorMessage(res, data, "Save failed"));
        return;
      }
      setProgress(100);

      if (!form.id) {
        setSavedSnapshot(snapshot(form, textSettings)); // don't warn on the redirect
        toast.success("Staff created — add a photo next");
        router.push(`/staff/${data.staff.id}?photo=1`);
      } else {
        const next = { ...form, ...fromServer(data.staff) };
        setForm(next);
        setSavedSnapshot(snapshot(next, textSettings));
        toast.success(data.unchanged ? "No changes to save" : "Saved");
        if (!data.unchanged) refresh();
      }
    } catch (error) {
      toast.error(networkMessage(error, "Save failed"));
    } finally {
      stopLoading();
      setSaving(false);
    }
  }

  async function approve() {
    if (dirty) {
      toast.warning("Save your changes before approving");
      return;
    }
    startLoading("Approving and publishing…", 8);
    try {
      setProgress(50);
      const res = await fetch(`/api/staff/${form.id}/approve`, { method: "POST" });
      const data = await readJson<{ staff?: Record<string, unknown> }>(res);
      if (!res.ok || !data.staff) {
        toast.error(errorMessage(res, data, "Approve failed"));
        return;
      }
      setProgress(100);
      setForm((f) => ({ ...f, ...fromServer(data.staff!) }));
      toast.success("Approved and published");
      refresh();
    } catch (error) {
      toast.error(networkMessage(error, "Approve failed"));
    } finally {
      stopLoading();
    }
  }

  // Errors thrown here are caught and shown by ConfirmDialog.
  async function setStatus(status: "ACTIVE" | "SUSPENDED") {
    const res = await fetch(`/api/staff/${form.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await readJson<{ staff?: Record<string, unknown> }>(res);
    if (!res.ok || !data.staff) {
      toast.error(errorMessage(res, data, "Status update failed"));
      return;
    }
    setForm((f) => ({ ...f, status: data.staff!.status as StaffData["status"] }));
    toast.success(status === "SUSPENDED" ? "Staff suspended" : "Staff reactivated");
    refresh();
  }

  async function regenerateQr() {
    const res = await fetch(`/api/staff/${form.id}/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "REGENERATE" }),
    });
    const data = await readJson<{ staff?: { qrToken: string }; warning?: string | null }>(res);
    if (!res.ok || !data.staff) {
      toast.error(errorMessage(res, data, "Failed to regenerate QR"));
      return;
    }
    setForm((f) => ({ ...f, qrToken: data.staff!.qrToken }));
    if (data.warning) toast.warning(data.warning);
    else toast.success("QR regenerated");
    refresh();
  }

  async function printOne() {
    startLoading("Preparing PDF…", 12);
    try {
      setProgress(40);
      const res = await fetch("/api/staff/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [form.id], mode: "single" }),
      });
      if (!res.ok) {
        toast.error(errorMessage(res, await readJson(res), "Print blocked"));
        return;
      }
      setProgress(90);
      downloadBlob(await res.blob(), `${form.idNumber}-id-card.pdf`);
      setProgress(100);
      setForm((f) => ({ ...f, lastPrintedAt: new Date().toISOString() }));
      toast.success("PDF download started");
      refresh();
    } catch (error) {
      toast.error(networkMessage(error, "PDF failed"));
    } finally {
      stopLoading();
    }
  }

  function downloadQr(format: "png" | "svg" = "png") {
    if (!form.id) return;
    const a = document.createElement("a");
    a.href = `/api/staff/${form.id}/qr/download?format=${format}`;
    a.download = `nsc-qr-${form.idNumber}.${format}`;
    a.click();
    toast.success(`QR ${format.toUpperCase()} download started`);
  }

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image — choose a JPG, PNG or WebP photo");
      return;
    }
    try {
      const normalized = await normalizePhoto(file);
      setRawFile(normalized.file);
      setCropMode("new");
      setCropSrc(normalized.dataUrl);
      if (normalized.resized) {
        const from = (normalized.originalBytes / 1024 / 1024).toFixed(1);
        const to = (normalized.file.size / 1024 / 1024).toFixed(1);
        toast.message(`Photo resized for upload (${from}MB → ${to}MB)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image");
    }
  }

  function closeCropper() {
    setCropSrc(null);
    setRawFile(null);
    setCropMode("new");
  }

  /** Shared tail of both photo-save paths. */
  function photoSaved(data: { staff?: Record<string, unknown>; dpi?: number }, message: string) {
    if (data.staff) setForm((f) => ({ ...f, ...fromServer(data.staff!) }));
    setPhotoRev((n) => n + 1);
    toast.success(`${message} (${Math.round(data.dpi ?? 0)} dpi)`);
    if (searchParams.get("photo")) router.replace(`/staff/${form.id}`, { scroll: false });
    refresh();
  }

  async function saveCrop(area: Area, zoom: number, rotation: number) {
    if (!form.id) return;
    const crop = { x: area.x, y: area.y, width: area.width, height: area.height, zoom, rotation };

    // Re-cropping the stored original: no upload, just a new cut on the server.
    if (cropMode === "recrop") {
      startLoading("Saving photo…", 6);
      try {
        const res = await fetch(`/api/staff/${form.id}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crop, reposition: true }),
        });
        const data = await readJson<{ staff?: Record<string, unknown>; dpi?: number }>(res);
        if (!res.ok) {
          toast.error(errorMessage(res, data, "Photo save failed"));
          return;
        }
        closeCropper();
        photoSaved(data, "Photo updated");
      } catch (error) {
        toast.error(networkMessage(error, "Photo save failed"));
      } finally {
        stopLoading();
      }
      return;
    }

    if (!rawFile) return;
    startLoading("Uploading photo…", 10);
    try {
      setProgress(10);
      const signRes = await fetch(`/api/photos/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: form.id }),
      });

      let res: Response;
      if (signRes.ok) {
        const sign = await readJson<{
          apiKey: string;
          timestamp: number;
          publicId: string;
          signature: string;
          uploadUrl: string;
        }>(signRes);

        const cloud = new FormData();
        cloud.append("file", rawFile);
        cloud.append("api_key", sign.apiKey);
        cloud.append("timestamp", String(sign.timestamp));
        cloud.append("public_id", sign.publicId);
        cloud.append("overwrite", "true");
        cloud.append("invalidate", "true");
        cloud.append("signature", sign.signature);

        const upload = await fetch(sign.uploadUrl, { method: "POST", body: cloud });
        if (!upload.ok) {
          const detail = await readJson<{ error?: { message?: string } }>(upload);
          toast.error(
            `Photo upload failed${detail.error?.message ? `: ${detail.error.message}` : ""}`,
          );
          return;
        }

        setProgress(60);
        res = await fetch(`/api/staff/${form.id}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crop, uploaded: true }),
        });
      } else if (signRes.status === 501) {
        // Cloudinary not configured (local dev): send the file to the server.
        const fd = new FormData();
        fd.append("file", rawFile);
        fd.append("crop", JSON.stringify(crop));
        setProgress(40);
        res = await fetch(`/api/staff/${form.id}/photo`, { method: "POST", body: fd });
      } else {
        toast.error(errorMessage(signRes, await readJson(signRes), "Could not start the upload"));
        return;
      }

      setProgress(80);
      if (res.status === 413) {
        toast.error(
          "Photo too large for the server to accept. Cloudinary upload is not configured on this deployment.",
        );
        return;
      }
      const data = await readJson<{ staff?: Record<string, unknown>; dpi?: number }>(res);
      if (!res.ok) {
        toast.error(errorMessage(res, data, `Photo save failed`));
        return;
      }

      setProgress(100);
      closeCropper();
      photoSaved(data, "Photo saved");
    } catch (error) {
      toast.error(networkMessage(error, "Photo save failed"));
    } finally {
      stopLoading();
    }
  }

  /** Reopen the cropper on the stored original, framed exactly as last saved. */
  function editPositioning() {
    if (!form.id || !form.photoOriginalKey) return;
    setRawFile(null);
    setCropMode("recrop");
    setCropSrc(`/api/photos/${form.id}/${form.photoOriginalKey}?r=${photoRev}`);
  }

  function startAdjust() {
    if (!form.id || !form.photoOriginalKey || adjustLoading) return;
    const src = `/api/photos/${form.id}/${form.photoOriginalKey}?r=${photoRev}`;
    setAdjustLoading(true);
    const img = new Image();
    img.onload = () => {
      const natural = { w: img.naturalWidth, h: img.naturalHeight };
      const saved = parsedCrop as CardCrop | undefined;
      const bounds = rotatedBounds(natural, saved?.rotation);
      const crop =
        saved && saved.width > 0 && saved.height > 0
          ? clampCrop(saved, bounds)
          : defaultCrop(bounds, saved?.rotation);
      setSide("front");
      setAdjust({ src, natural, crop });
      setAdjustLoading(false);
      // Bring the card (and its controls) into view — on phones it may be off-screen.
      requestAnimationFrame(() =>
        previewCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    };
    img.onerror = () => {
      setAdjustLoading(false);
      toast.error("Could not load the original photo");
    };
    img.src = src;
  }

  async function saveAdjust() {
    if (!form.id || !adjust || adjustSaving) return;
    const bounds = rotatedBounds(adjust.natural, adjust.crop.rotation);
    setAdjustSaving(true);
    try {
      const res = await fetch(`/api/staff/${form.id}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: { ...roundCrop(adjust.crop, bounds), zoom: cropZoom(adjust.crop, bounds) },
          reposition: true,
        }),
      });
      const data = await readJson<{ staff?: Record<string, unknown>; dpi?: number }>(res);
      if (!res.ok) {
        toast.error(errorMessage(res, data, "Could not save position"));
        return;
      }
      setAdjust(null);
      photoSaved(data, "Photo position saved");
    } catch (error) {
      toast.error(networkMessage(error, "Could not save position"));
    } finally {
      setAdjustSaving(false);
    }
  }

  // Enter saves, Escape cancels while adjusting on the card.
  const saveAdjustRef = useRef(saveAdjust);
  saveAdjustRef.current = saveAdjust;
  useEffect(() => {
    if (!adjust) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(t.tagName)) return;
      if (e.key === "Escape") setAdjust(null);
      else if (e.key === "Enter") {
        e.preventDefault();
        void saveAdjustRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjust]);

  const adjustBounds = adjust ? rotatedBounds(adjust.natural, adjust.crop.rotation) : null;

  const detailsDone = Boolean(form.idNumber && form.firstName && form.lastName && form.designation);

  const steps: { label: string; state: "done" | "current" | "todo" | "blocked" }[] = [
    { label: "Details", state: detailsDone ? "done" : "current" },
    { label: "Photo", state: !form.id ? "todo" : hasPhoto ? "done" : "current" },
    { label: "Approve", state: !hasPhoto ? "todo" : isApproved ? "done" : "current" },
    {
      label: "Print",
      state: form.status === "SUSPENDED" ? "blocked" : printable ? "done" : "todo",
    },
  ];
  const activeStep = steps.findIndex((st) => st.state === "current");

  const fields = [
    ["idNumber", "ID number"],
    ["lastName", "Surname (bold on card)"],
    ["firstName", "First name"],
    ["middleName", "Middle name"],
    ["designation", "Designation"],
    ["posting", "Posting / job title"],
    ["department", "Department"],
    ["dateIssued", "Date issued"],
    ["officeLine", "Office line"],
    ["emergencyContactName", "Emergency contact"],
    ["emergencyContactPhone", "Emergency phone"],
    ...(form.canMedical !== false
      ? ([
          ["bloodGroup", "Blood group (admin only)"],
          ["genotype", "Genotype (admin only)"],
        ] as const)
      : []),
  ] as const;

  const approveBlocked = !hasPhoto
    ? "Add a photo before approving"
    : textOverflow
      ? "Card text does not fit — adjust the card text first"
      : null;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        alignItems: "start",
        gridTemplateColumns: {
          xs: "minmax(0,1fr)",
          md: "minmax(0,1fr) 340px",
          xl: "minmax(0,1fr) 380px",
        },
      }}
    >
      <Stack spacing={2.5} sx={{ order: { xs: 2, md: 1 }, minWidth: 0 }}>
        <Card sx={{ px: 2, py: 2.5 }}>
          <Stepper activeStep={activeStep === -1 ? steps.length : activeStep} alternativeLabel>
            {steps.map((st) => (
              <Step key={st.label} completed={st.state === "done"}>
                <StepLabel error={st.state === "blocked"}>
                  {st.state === "blocked" ? "Suspended" : st.label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Card>

        <Card sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6">Staff details</Typography>
          <Typography variant="body2" color="text.secondary">
            Edits update the live card preview. Save when ready.
          </Typography>
          <Box
            sx={{
              mt: 2.5,
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            }}
          >
            {fields.map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                type={key === "dateIssued" ? "date" : "text"}
                value={(form[key] as string) ?? ""}
                onChange={(e) => set(key, e.target.value)}
                required={["idNumber", "lastName", "firstName", "designation"].includes(key)}
                slotProps={key === "dateIssued" ? { inputLabel: { shrink: true } } : undefined}
              />
            ))}
          </Box>
        </Card>

        <Card sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6">Card design</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick a front; the back follows the same design.
          </Typography>
          <TemplatePicker
            front={form.frontTemplate}
            back={form.backTemplate}
            onFront={(id) => set("frontTemplate", id)}
            onBack={(id) => set("backTemplate", id)}
          />
          {crossBrand || mismatch ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {crossBrand
                ? "Front and back belong to different card designs."
                : "Front and back colour families differ."}
            </Alert>
          ) : null}
          <Box sx={{ mt: 3 }}>
            <TypeScaleControl value={textSettings} onChange={setTextSettings} layout={cardLayout} />
          </Box>
        </Card>

        <Card
          ref={photoSectionRef}
          sx={{
            p: { xs: 2, md: 3 },
            ...(form.id && !hasPhoto
              ? { borderColor: "primary.main", bgcolor: "var(--md-primary-container)" }
              : {}),
          }}
        >
          {form.id ? (
            <>
              <Typography variant="h6">{hasPhoto ? "Staff photo" : "Add a staff photo"}</Typography>
              <Typography variant="body2" color="text.secondary">
                {hasPhoto
                  ? "Move and zoom the photo directly on the card, or re-crop and rotate it."
                  : "Use the camera or upload a file, then crop it to fit the card."}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
                <Button component="label" variant={hasPhoto ? "outlined" : "contained"}>
                  {hasPhoto ? "Replace photo" : "Take or upload photo"}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) onFile(f);
                    }}
                  />
                </Button>
                {hasPhoto && form.photoOriginalKey ? (
                  <Button
                    variant="outlined"
                    onClick={startAdjust}
                    disabled={Boolean(adjust) || adjustLoading}
                    startIcon={adjustLoading ? <CircularProgress size={14} color="inherit" /> : null}
                  >
                    {adjustLoading ? "Loading photo…" : "Adjust on card"}
                  </Button>
                ) : null}
                {hasPhoto && form.photoOriginalKey ? (
                  <Button variant="text" onClick={editPositioning} disabled={Boolean(adjust)}>
                    Crop &amp; rotate
                  </Button>
                ) : null}
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Save the record first, then you can capture a photo.
            </Typography>
          )}
        </Card>

        {form.hasPendingEdits ? (
          <Alert severity="warning">
            Changes awaiting approval — printing blocked until published.
          </Alert>
        ) : null}

        <Card
          sx={{
            p: 2,
            position: { xs: "sticky", sm: "static" },
            bottom: 12,
            zIndex: 20,
            boxShadow: { xs: "var(--md-elevation-2)", sm: "none" },
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="contained"
              onClick={save}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {saving ? "Saving…" : form.id ? "Save" : "Create record"}
            </Button>
            {form.id && form.canApprove !== false && !isApproved ? (
              <Tooltip title={approveBlocked ?? ""}>
                <span>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={approve}
                    disabled={Boolean(approveBlocked)}
                  >
                    Approve &amp; publish
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            {form.id && form.canPrint !== false ? (
              <Tooltip title={printable ? "" : "Approve with a photo before printing"}>
                <span>
                  <Button variant="outlined" onClick={printOne} disabled={!printable}>
                    Download PDF
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            {form.id ? (
              <Button variant="text" onClick={() => setMoreOpen((v) => !v)}>
                {moreOpen ? "Hide more" : "More actions"}
              </Button>
            ) : null}
            <Box sx={{ flex: 1 }} />
            {refreshing ? (
              <Chip
                className="nsc-anim-fade"
                size="small"
                icon={<CircularProgress size={12} />}
                label="Refreshing…"
                variant="outlined"
              />
            ) : dirty ? (
              <Chip className="nsc-anim-fade" size="small" color="warning" label="Unsaved changes" />
            ) : null}
          </Stack>

          {form.id ? (
            <Collapse in={moreOpen}>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{
                  flexWrap: "wrap",
                  mt: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "var(--md-surface-container-low)",
                }}
              >
                {hasQr ? (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        window.open(`/v/${form.qrToken}`, "_blank", "noopener,noreferrer")
                      }
                    >
                      Preview QR page
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => downloadQr("png")}>
                      QR PNG
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => downloadQr("svg")}>
                      QR SVG
                    </Button>
                  </>
                ) : null}
                {form.canSuspend !== false ? (
                  form.status === "SUSPENDED" ? (
                    <Button size="small" variant="outlined" onClick={() => setReactivateOpen(true)}>
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => setSuspendOpen(true)}
                    >
                      Suspend
                    </Button>
                  )
                ) : null}
                {hasQr && form.canQr !== false ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => setRegenOpen(true)}
                  >
                    Regenerate QR{form.lastPrintedAt ? " (was printed)" : ""}
                  </Button>
                ) : null}
              </Stack>
            </Collapse>
          ) : null}
        </Card>
      </Stack>

      <Box
        component="aside"
        sx={{ order: { xs: 1, md: 2 }, position: { md: "sticky" }, top: { md: 80 } }}
      >
        <Card sx={{ p: 2 }} ref={previewCardRef}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1 }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                Live ID card
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {adjust
                  ? "Drag the photo · scroll to zoom · Enter to save"
                  : refreshing
                    ? "Syncing with server…"
                    : "Updates as you edit"}
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={side}
              onChange={(_, v: "front" | "back" | null) => {
                if (v) setSide(v);
              }}
              disabled={Boolean(adjust)}
            >
              <ToggleButton value="front" sx={{ px: 2 }}>
                Front
              </ToggleButton>
              <ToggleButton value="back" sx={{ px: 2 }}>
                Back
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box
            sx={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
              maxHeight: "70vh",
              overflow: "auto",
              borderRadius: 3,
              bgcolor: "var(--md-surface-container)",
              p: 2,
              transition: "box-shadow 200ms ease, opacity 200ms ease",
              boxShadow: adjust ? "inset 0 0 0 2px var(--md-tertiary, #0e7490)" : "none",
              opacity: refreshing && !adjust ? 0.85 : 1,
            }}
          >
            <CardPreview
              side={side}
              frontTemplate={form.frontTemplate}
              backTemplate={form.backTemplate}
              firstName={form.firstName || "FIRST"}
              middleName={form.middleName}
              lastName={form.lastName || "SURNAME"}
              designation={form.designation || "DESIGNATION"}
              idNumber={form.idNumber || "0000000000"}
              qrToken={form.qrToken || "previewtoken0001"}
              photoUrl={photoUrl}
              text={textSettings}
              scale={1.9}
              photoAdjust={
                adjust
                  ? {
                      ...adjust,
                      onChange: (crop) => setAdjust((a) => (a ? { ...a, crop } : a)),
                    }
                  : undefined
              }
            />
          </Box>
          {adjust && adjustBounds ? (
            <Box
              className="nsc-anim-slide-up"
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 3,
                bgcolor: "var(--md-surface-container-high)",
                boxShadow: "var(--md-elevation-2)",
                // Stays in reach while the card scrolls on small screens.
                position: { xs: "sticky", md: "static" },
                bottom: 12,
                zIndex: 5,
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Typography variant="caption" sx={{ fontWeight: 500 }} id="adjust-zoom">
                  Zoom
                </Typography>
                <Slider
                  aria-labelledby="adjust-zoom"
                  size="small"
                  min={1}
                  max={maxZoom(adjustBounds)}
                  step={0.01}
                  value={cropZoom(adjust.crop, adjustBounds)}
                  onChange={(_, v) =>
                    setAdjust((a) =>
                      a ? { ...a, crop: zoomCrop(a.crop, v as number, adjustBounds) } : a,
                    )
                  }
                />
                <Chip
                  size="small"
                  color={cropDpi(adjust.crop) < PHOTO_DPI_FLOOR * 1.1 ? "warning" : "default"}
                  label={`${Math.round(cropDpi(adjust.crop))} dpi`}
                  sx={{ flexShrink: 0 }}
                />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: "flex-end" }}>
                <Button
                  variant="text"
                  size="small"
                  disabled={adjustSaving}
                  onClick={() =>
                    setAdjust((a) =>
                      a ? { ...a, crop: defaultCrop(adjustBounds, a.crop.rotation) } : a,
                    )
                  }
                >
                  Reset
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={adjustSaving}
                  onClick={() => setAdjust(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={saveAdjust}
                  disabled={adjustSaving}
                  startIcon={adjustSaving ? <CircularProgress size={14} color="inherit" /> : null}
                >
                  {adjustSaving ? "Saving…" : "Save position"}
                </Button>
              </Stack>
            </Box>
          ) : null}
        </Card>
      </Box>

      {cropSrc ? (
        <PhotoCropper
          imageSrc={cropSrc}
          frontTemplate={form.frontTemplate}
          // Saved framing only applies to the same image it was cut from.
          initialCrop={cropMode === "recrop" ? (parsedCrop as SavedCrop | undefined) : undefined}
          onCancel={closeCropper}
          onSave={saveCrop}
        />
      ) : null}

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspend this staff card?"
        description="The verification page will show Suspended and the card should not be used for access."
        confirmLabel="Suspend"
        destructive
        onConfirm={() => setStatus("SUSPENDED")}
      />
      <ConfirmDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        title="Reactivate this staff card?"
        description="The card will show as Active on the verification page again."
        confirmLabel="Reactivate"
        onConfirm={() => setStatus("ACTIVE")}
      />
      <ConfirmDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate QR code?"
        description="Printed cards with the old QR become invalid immediately. This cannot be undone."
        confirmLabel="Regenerate"
        destructive
        requireText="REGENERATE"
        onConfirm={regenerateQr}
      />

      <RefreshIndicator show={refreshing} />
    </Box>
  );
}
