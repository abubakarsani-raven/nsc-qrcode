"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CardPreview } from "@/components/id-card/CardPreview";
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
  const styles = {
    done: "bg-[#e8f8ee] text-[var(--nsc-green)]",
    current: "bg-[var(--nsc-ink)] text-white",
    todo: "bg-[var(--nsc-fill)] text-[var(--nsc-secondary)]",
    blocked: "bg-[#ffeceb] text-[#c41e16]",
  } as const;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight ${styles[state]}`}
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
        <div className="nsc-surface flex flex-wrap gap-2 p-3 sm:p-4">
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

        <div className="nsc-surface space-y-5 p-5 md:p-6">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-[var(--nsc-ink)]">
              Staff details
            </h2>
            <p className="mt-1 text-[13px] text-[var(--nsc-secondary)]">
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
              <label key={key} className="text-[13px]">
                <span className="text-[var(--nsc-secondary)]">{label}</span>
                <input
                  className="nsc-field"
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </label>
            ))}
            {form.canMedical !== false && (
              <>
                <label className="text-[13px]">
                  <span className="text-[var(--nsc-secondary)]">
                    Blood group (admin only)
                  </span>
                  <input
                    className="nsc-field"
                    value={form.bloodGroup ?? ""}
                    onChange={(e) => set("bloodGroup", e.target.value)}
                  />
                </label>
                <label className="text-[13px]">
                  <span className="text-[var(--nsc-secondary)]">
                    Genotype (admin only)
                  </span>
                  <input
                    className="nsc-field"
                    value={form.genotype ?? ""}
                    onChange={(e) => set("genotype", e.target.value)}
                  />
                </label>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="front-template">Front template</Label>
              <Select
                value={form.frontTemplate}
                onValueChange={(value) => {
                  if (value != null) set("frontTemplate", value as FrontTemplateId);
                }}
                items={FRONT_TEMPLATE_LABELS}
              >
                <SelectTrigger id="front-template" className="w-full">
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
            <div className="space-y-1.5">
              <Label htmlFor="back-template">Back template</Label>
              <Select
                value={form.backTemplate}
                onValueChange={(value) => {
                  if (value != null) set("backTemplate", value as BackTemplateId);
                }}
                items={BACK_TEMPLATE_LABELS}
              >
                <SelectTrigger id="back-template" className="w-full">
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
          {mismatch ? (
            <p className="rounded-xl bg-[#fff4e5] px-3 py-2 text-[13px] text-[#9a5b00]">
              Front and back colour families differ.
            </p>
          ) : null}

          <div
            ref={photoSectionRef}
            className={`rounded-2xl border border-dashed p-4 ${
              form.id && !hasPhoto
                ? "border-[var(--nsc-green)] bg-[#eef5f0]"
                : "border-[var(--nsc-separator)] bg-[#fafafa]"
            }`}
          >
            {form.id ? (
              <div className="space-y-2">
                <p className="text-[13px] font-medium text-[var(--nsc-ink)]">
                  {hasPhoto ? "Staff photo" : "Add a staff photo"}
                </p>
                <p className="text-[12px] text-[var(--nsc-secondary)]">
                  Use the camera or upload a file. Crop to fit the card.
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-1 block w-full text-[13px] text-[var(--nsc-secondary)] file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--nsc-ink)] file:shadow-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
                {hasPhoto ? (
                  <button
                    type="button"
                    onClick={editPositioning}
                    className="text-[13px] font-medium text-[var(--nsc-green)] hover:underline"
                  >
                    Edit positioning
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--nsc-secondary)]">
                Save the record first, then you can capture a photo.
              </p>
            )}
          </div>

          {form.hasPendingEdits ? (
            <p className="rounded-xl bg-[#fff4e5] px-3 py-2 text-[13px] text-[#9a5b00]">
              Changes awaiting approval — printing blocked until published.
            </p>
          ) : null}

          <div className="sticky bottom-3 z-20 -mx-1 space-y-3 rounded-2xl border border-[var(--nsc-separator)] bg-white/95 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
            <div className="flex flex-wrap gap-2 border-t border-[var(--nsc-separator)] pt-0 sm:border-t sm:pt-4">
              <Button
                type="button"
                onClick={save}
                className="rounded-full bg-[var(--nsc-green)] px-4 hover:bg-[var(--nsc-green-hover)]"
              >
                Save
              </Button>
              {form.id && form.canApprove !== false && !isApproved ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={approve}
                  disabled={!hasPhoto}
                  className="rounded-full border-[var(--nsc-green)] text-[var(--nsc-green)]"
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
                  className="rounded-full"
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
                  className="rounded-full"
                >
                  {moreOpen ? "Hide more" : "More actions"}
                </Button>
              ) : null}
            </div>

            {form.id && moreOpen ? (
              <div className="flex flex-wrap gap-2 rounded-xl bg-[#fafafa] p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
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
                  className="rounded-full"
                  onClick={() => downloadQr("png")}
                >
                  QR PNG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
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
                      className="rounded-full"
                      onClick={() => setReactivateOpen(true)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setSuspendOpen(true)}
                    >
                      Suspend
                    </Button>
                  )
                ) : null}
                {form.canQr !== false ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
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
        <div className="nsc-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--nsc-ink)]">
                Live ID card
              </h2>
              <p className="text-[12px] text-[var(--nsc-secondary)]">
                Updates as you edit
              </p>
            </div>
            <div className="flex rounded-full bg-[var(--nsc-fill)] p-0.5">
              <button
                type="button"
                onClick={() => setSide("front")}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  side === "front"
                    ? "bg-white text-[var(--nsc-ink)] shadow-sm"
                    : "text-[var(--nsc-secondary)]"
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setSide("back")}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  side === "back"
                    ? "bg-white text-[var(--nsc-ink)] shadow-sm"
                    : "text-[var(--nsc-secondary)]"
                }`}
              >
                Back
              </button>
            </div>
          </div>
          <div className="flex max-h-[70vh] justify-center overflow-auto rounded-xl bg-[#f5f5f7] p-4">
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
