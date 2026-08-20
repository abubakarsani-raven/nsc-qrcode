"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CardPreview } from "@/components/id-card/CardPreview";
import { TypeScaleControl } from "@/components/id-card/type-scale-control";
import { layoutName, nameOverflows } from "@/lib/id-card/name-layout";
import {
  parseTypeScale,
  serializeTypeScale,
  type CardTypeScale,
} from "@/lib/id-card/type-scale";
import { PhotoCropper } from "@/components/photo/PhotoCropper";
import { useLoading } from "@/lib/loading-context";
import { normalizePhoto } from "@/lib/photo/client-resize";
import {
  BACK_TEMPLATES,
  FRONT_DEFAULT_BACK,
  FRONT_TEMPLATES,
  nameColorMismatch,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import {
  BACK_TEMPLATE_LABELS,
  FRONT_TEMPLATE_LABELS,
} from "@/lib/id-card/template-labels";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function StepPill({
  label,
  state,
}: {
  label: string;
  state: "done" | "current" | "todo" | "blocked";
}) {
  // Same colour language as the stage rail on the staff list: hull green is
  // finished work, channel blue is where you are now, flag red is blocked.
  const styles = {
    done: "bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]",
    current: "bg-[var(--md-tertiary)] text-[var(--md-on-tertiary)]",
    todo: "border border-[var(--md-outline)] text-[var(--md-on-surface-variant)]",
    blocked:
      "bg-[var(--md-error-container)] text-[var(--md-on-error-container)]",
  } as const;
  return (
    <span
      className={`inline-flex h-8 items-center rounded-[var(--md-shape-sm)] px-3 text-sm font-medium tracking-[0.007em] ${styles[state]}`}
    >
      {label}
    </span>
  );
}

export function StaffEditor({ initial }: { initial?: StaffData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, setProgress, stopLoading } = useLoading();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSectionRef = useRef<HTMLDivElement>(null);

  const [typeScale, setTypeScale] = useState<CardTypeScale>(() =>
    parseTypeScale(initial?.cardTypeScale),
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

  const mismatch = nameColorMismatch(form.frontTemplate, form.backTemplate);
  // Fitted size at 100%, plus whether the current nudge pushes it off the card.
  const nameGiven = [form.firstName, form.middleName]
    .filter(Boolean)
    .join(" ");
  const nameLayoutAtDefault = useMemo(
    () => layoutName(form.lastName, nameGiven, form.frontTemplate),
    [form.lastName, nameGiven, form.frontTemplate],
  );
  const nameTooWide = useMemo(
    () =>
      Boolean(
        nameOverflows(
          layoutName(form.lastName, nameGiven, form.frontTemplate, typeScale.name),
          form.frontTemplate,
        ),
      ),
    [form.lastName, nameGiven, form.frontTemplate, typeScale.name],
  );
  const hasPhoto = Boolean(form.photoPreviewKey);
  const isApproved =
    form.approvalState === "APPROVED" && !form.hasPendingEdits;
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
    startLoading(form.id ? "Updating staff..." : "Creating staff record...", 5);

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
        bloodGroup: form.bloodGroup || null,
        genotype: form.genotype || null,
        frontTemplate: form.frontTemplate,
        backTemplate: form.backTemplate,
        cardTypeScale: serializeTypeScale(typeScale),
      };

      setProgress(30);

      const res = await fetch(form.id ? `/api/staff/${form.id}` : "/api/staff", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setProgress(70);

      const data = await res.json();
      if (!res.ok) {
        stopLoading();
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }

      setProgress(100);
      stopLoading();

      if (!form.id) {
        toast.success("Staff created — add a photo next");
        router.push(`/staff/${data.staff.id}?photo=1`);
      } else {
        setForm((f) => ({ ...f, ...data.staff }));
        toast.success("Saved");
        router.refresh();
      }
    } catch (error) {
      stopLoading();
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function approve() {
    startLoading("Approving and publishing...", 8);
    try {
      setProgress(50);
      const res = await fetch(`/api/staff/${form.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        stopLoading();
        toast.error(data.error || "Approve failed");
        return;
      }
      setProgress(100);
      stopLoading();
      setForm((f) => ({ ...f, ...data.staff }));
      toast.success("Approved and published");
      router.refresh();
    } catch (error) {
      stopLoading();
      toast.error(error instanceof Error ? error.message : "Approve failed");
    }
  }

  async function setStatus(status: "ACTIVE" | "SUSPENDED") {
    const res = await fetch(`/api/staff/${form.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Status update failed");
      return;
    }
    setForm((f) => ({ ...f, ...data.staff }));
    toast.success(status === "SUSPENDED" ? "Staff suspended" : "Staff reactivated");
    router.refresh();
  }

  async function regenerateQr() {
    const res = await fetch(`/api/staff/${form.id}/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "REGENERATE" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to regenerate QR");
      return;
    }
    setForm((f) => ({ ...f, qrToken: data.staff.qrToken }));
    if (data.warning) toast.warning(data.warning);
    else toast.success("QR regenerated");
    router.refresh();
  }

  async function printOne() {
    startLoading("Preparing PDF...", 12);
    try {
      setProgress(40);
      const res = await fetch("/api/staff/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [form.id], mode: "single" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        stopLoading();
        toast.error(data.error || "Print blocked");
        return;
      }
      setProgress(90);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.idNumber}-id-card.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setProgress(100);
      stopLoading();
      toast.success("PDF download started");
    } catch (error) {
      stopLoading();
      toast.error(error instanceof Error ? error.message : "PDF failed");
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
    try {
      const normalized = await normalizePhoto(file);
      setRawFile(normalized.file);
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

  async function saveCrop(area: Area, zoom: number) {
    if (!form.id || !rawFile) return;

    startLoading("Processing photo...", 10);

    try {
      const crop = {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        zoom,
      };

      setProgress(10);

      const signRes = await fetch(`/api/photos/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: form.id }),
      });

      let res: Response;
      if (signRes.ok) {
        const sign = await signRes.json();

        const cloud = new FormData();
        cloud.append("file", rawFile);
        cloud.append("api_key", sign.apiKey);
        cloud.append("timestamp", String(sign.timestamp));
        cloud.append("public_id", sign.publicId);
        cloud.append("overwrite", "true");
        cloud.append("invalidate", "true");
        cloud.append("signature", sign.signature);

        const upload = await fetch(sign.uploadUrl, {
          method: "POST",
          body: cloud,
        });
        if (!upload.ok) {
          const detail = await upload.text();
          stopLoading();
          toast.error(`Upload to Cloudinary failed: ${detail.slice(0, 200)}`);
          return;
        }

        setProgress(60);

        res = await fetch(`/api/staff/${form.id}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crop, uploaded: true }),
        });
      } else {
        const fd = new FormData();
        fd.append("file", rawFile);
        fd.append("crop", JSON.stringify(crop));
        setProgress(40);
        res = await fetch(`/api/staff/${form.id}/photo`, {
          method: "POST",
          body: fd,
        });
      }

      setProgress(80);

      if (res.status === 413) {
        stopLoading();
        toast.error(
          "Photo too large for the server to accept. Cloudinary upload is not configured on this deployment.",
        );
        return;
      }

      const data = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        stopLoading();
        toast.error(data.error || `Photo save failed (${res.status})`);
        return;
      }

      setProgress(100);
      stopLoading();

      setForm((f) => ({ ...f, ...data.staff }));
      setPhotoRev((n) => n + 1);
      setCropSrc(null);
      setRawFile(null);
      toast.success(`Photo saved (${Math.round(data.dpi)} dpi)`);
      router.replace(`/staff/${form.id}`);
      router.refresh();
    } catch (error) {
      stopLoading();
      toast.error(error instanceof Error ? error.message : "Photo save failed");
    }
  }

  async function editPositioning() {
    if (!form.id || !form.photoOriginalKey) return;
    try {
      const res = await fetch(`/api/photos/${form.id}/${form.photoOriginalKey}`);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], form.photoOriginalKey, { type: blob.type });
        onFile(file);
      } else {
        toast.error("Failed to load photo for editing");
      }
    } catch {
      toast.error("Failed to load photo for editing");
    }
  }

  const detailsDone = Boolean(
    form.idNumber && form.firstName && form.lastName && form.designation,
  );

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-2 space-y-5 md:order-1">
        <div className="md-card flex flex-wrap gap-2 p-3 sm:p-4">
          <StepPill
            label="1. Details"
            state={detailsDone ? "done" : "current"}
          />
          <StepPill
            label="2. Photo"
            state={
              !form.id
                ? "todo"
                : hasPhoto
                  ? "done"
                  : "current"
            }
          />
          <StepPill
            label="3. Approve"
            state={
              !hasPhoto
                ? "todo"
                : isApproved
                  ? "done"
                  : "current"
            }
          />
          <StepPill
            label="4. Print"
            state={
              form.status === "SUSPENDED"
                ? "blocked"
                : printable
                  ? "done"
                  : "todo"
            }
          />
        </div>

        <div className="md-card space-y-6 p-4 md:p-6">
          <div>
            <h2 className="md-title-medium">Staff details</h2>
            <p className="md-body-medium mt-1 text-[var(--md-on-surface-variant)]">
              Edits update the live card preview. Save when ready.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["idNumber", "ID number"],
                ["lastName", "Surname (bold on card)"],
                ["firstName", "First name"],
                ["middleName", "Middle name"],
                ["designation", "Designation"],
                ["posting", "Posting / Job Title"],
                ["department", "Department"],
                ["dateIssued", "Date Issued"],
                ["officeLine", "Office line"],
                ["emergencyContactName", "Emergency contact"],
                ["emergencyContactPhone", "Emergency phone"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="md-field-label">{label}</span>
                <input
                  className="nsc-field"
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </label>
            ))}
            {form.canMedical !== false && (
              <>
                <label className="block">
                  <span className="md-field-label">Blood group (admin only)</span>
                  <input
                    className="nsc-field"
                    value={form.bloodGroup ?? ""}
                    onChange={(e) => set("bloodGroup", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="md-field-label">Genotype (admin only)</span>
                  <input
                    className="nsc-field"
                    value={form.genotype ?? ""}
                    onChange={(e) => set("genotype", e.target.value)}
                  />
                </label>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="front-template" className="md-field-label">
                Front template
              </Label>
              <Select
                value={form.frontTemplate}
                onValueChange={(value) => {
                  if (value != null) set("frontTemplate", value as FrontTemplateId);
                }}
                items={FRONT_TEMPLATE_LABELS}
              >
                <SelectTrigger id="front-template" className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FRONT_TEMPLATES) as FrontTemplateId[]).map((id) => (
                    <SelectItem key={id} value={id}>
                      {FRONT_TEMPLATE_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="back-template" className="md-field-label">
                Back template
              </Label>
              <Select
                value={form.backTemplate}
                onValueChange={(value) => {
                  if (value != null) set("backTemplate", value as BackTemplateId);
                }}
                items={BACK_TEMPLATE_LABELS}
              >
                <SelectTrigger id="back-template" className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BACK_TEMPLATES) as BackTemplateId[]).map((id) => (
                    <SelectItem key={id} value={id}>
                      {BACK_TEMPLATE_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <TypeScaleControl
            value={typeScale}
            onChange={setTypeScale}
            nameBasePt={nameLayoutAtDefault.fontSizePt}
            nameOverflows={nameTooWide}
          />

          {mismatch ? (
            <p className="md-body-medium rounded-[var(--md-shape-xs)] bg-[var(--md-warning-container)] px-3 py-2 text-[var(--md-on-warning-container)]">
              Front and back colour families differ.
            </p>
          ) : null}

          <div
            ref={photoSectionRef}
            className={`rounded-[var(--md-shape-md)] border border-dashed p-4 ${
              form.id && !hasPhoto
                ? "border-[var(--md-primary)] bg-[var(--md-primary-container)]/25"
                : "border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)]"
            }`}
          >
            {form.id ? (
              <div className="space-y-2">
                <p className="md-title-small">
                  {hasPhoto ? "Staff photo" : "Add a staff photo"}
                </p>
                <p className="md-body-small">
                  Use the camera or upload a file. Crop to fit the card.
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-2 block w-full text-sm text-[var(--md-on-surface-variant)] file:mr-3 file:h-10 file:rounded-full file:border file:border-[var(--md-outline)] file:bg-transparent file:px-4 file:text-sm file:font-medium file:text-[var(--md-primary)]"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
                {hasPhoto ? (
                  <button
                    type="button"
                    onClick={editPositioning}
                    className="md-label-large text-[var(--md-primary)] hover:underline"
                  >
                    Edit positioning
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="md-body-medium text-[var(--md-on-surface-variant)]">
                Save the record first, then you can capture a photo.
              </p>
            )}
          </div>

          {form.hasPendingEdits ? (
            <p className="md-body-medium rounded-[var(--md-shape-xs)] bg-[var(--md-warning-container)] px-3 py-2 text-[var(--md-on-warning-container)]">
              Changes awaiting approval — printing blocked until published.
            </p>
          ) : null}

          <div className="sticky bottom-3 z-20 -mx-1 space-y-3 rounded-[var(--md-shape-lg)] bg-[var(--md-surface-container-high)] p-3 shadow-[var(--md-elevation-2)] sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <div className="flex flex-wrap gap-2 sm:border-t sm:border-[var(--md-outline-variant)] sm:pt-5">
              <Button type="button" onClick={save}>
                Save
              </Button>
              {form.id && form.canApprove !== false && !isApproved ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={approve}
                  disabled={!hasPhoto}
                  title={!hasPhoto ? "Add a photo before approving" : undefined}
                >
                  Approve / publish
                </Button>
              ) : null}
              {form.id && form.canPrint !== false ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={printOne}
                  disabled={!printable}
                  title={
                    !printable
                      ? "Approve with a photo before printing"
                      : undefined
                  }
                >
                  Download PDF
                </Button>
              ) : null}
              {form.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  {moreOpen ? "Hide more" : "More actions"}
                </Button>
              ) : null}
            </div>

            {form.id && moreOpen ? (
              <div className="flex flex-wrap gap-2 rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/v/${form.qrToken}`;
                    window.open(qrUrl, "_blank");
                  }}
                >
                  Preview QR page
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadQr("png")}
                >
                  QR PNG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadQr("svg")}
                >
                  QR SVG
                </Button>
                {form.canSuspend !== false ? (
                  form.status === "SUSPENDED" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReactivateOpen(true)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setSuspendOpen(true)}
                    >
                      Suspend
                    </Button>
                  )
                ) : null}
                {form.canQr !== false ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setRegenOpen(true)}
                  >
                    Regenerate QR
                    {form.lastPrintedAt ? " (was printed)" : ""}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="order-1 space-y-3 md:sticky md:top-20 md:order-2">
        <div className="md-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="md-title-medium">Live ID card</h2>
              <p className="md-body-small">Updates as you edit</p>
            </div>
            {/* M3 segmented button */}
            <div className="flex h-10 overflow-hidden rounded-full border border-[var(--md-outline)]">
              <button
                type="button"
                onClick={() => setSide("front")}
                aria-pressed={side === "front"}
                className={`px-4 text-sm font-medium tracking-[0.007em] transition-colors ${
                  side === "front"
                    ? "bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)]"
                    : "text-[var(--md-on-surface-variant)] hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]"
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setSide("back")}
                aria-pressed={side === "back"}
                className={`border-l border-[var(--md-outline)] px-4 text-sm font-medium tracking-[0.007em] transition-colors ${
                  side === "back"
                    ? "bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)]"
                    : "text-[var(--md-on-surface-variant)] hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]"
                }`}
              >
                Back
              </button>
            </div>
          </div>
          <div className="flex max-h-[70vh] justify-center overflow-auto rounded-[var(--md-shape-md)] bg-[var(--md-surface-container)] p-4">
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
              typeScale={typeScale}
              scale={1.9}
            />
          </div>
        </div>
      </aside>

      {cropSrc ? (
        <PhotoCropper
          imageSrc={cropSrc}
          frontTemplate={form.frontTemplate}
          initialCrop={parsedCrop}
          onCancel={() => {
            setCropSrc(null);
            setRawFile(null);
          }}
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
    </div>
  );
}
