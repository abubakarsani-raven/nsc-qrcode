"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export function StaffEditor({ initial }: { initial?: StaffData }) {
  const router = useRouter();
  const { startLoading, setProgress, stopLoading } = useLoading();
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
  const [msg, setMsg] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);

  const mismatch = nameColorMismatch(form.frontTemplate, form.backTemplate);

  const photoUrl = useMemo(() => {
    if (!form.id || !form.photoPreviewKey) return null;
    return `/api/photos/${form.id}/${form.photoPreviewKey}`;
  }, [form.id, form.photoPreviewKey]);

  const parsedCrop = useMemo(() => {
    if (!form.photoCrop) return undefined;
    try {
      return JSON.parse(form.photoCrop);
    } catch {
      return undefined;
    }
  }, [form.photoCrop]);

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
    setMsg("");
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
        setMsg(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }

      setProgress(100);
      stopLoading();

      if (!form.id) router.push(`/staff/${data.staff.id}`);
      else {
        setForm((f) => ({ ...f, ...data.staff }));
        setMsg("✓ Saved successfully");
        router.refresh();
      }
    } catch (error) {
      stopLoading();
      setMsg(error instanceof Error ? error.message : "Save failed");
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
        return setMsg(data.error || "Approve failed");
      }
      setProgress(100);
      stopLoading();
      setForm((f) => ({ ...f, ...data.staff }));
      setMsg("✓ Approved & published");
      router.refresh();
    } catch (error) {
      stopLoading();
      setMsg(error instanceof Error ? error.message : "Approve failed");
    }
  }

  async function setStatus(status: "ACTIVE" | "SUSPENDED") {
    const res = await fetch(`/api/staff/${form.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Status update failed");
    setForm((f) => ({ ...f, ...data.staff }));
    setMsg(status === "SUSPENDED" ? "Suspended" : "Reactivated");
  }

  async function regenerateQr() {
    if (!confirm("Regenerate QR? Printed cards become invalid. Type OK in next step.")) return;
    const typed = prompt('Type REGENERATE to confirm');
    if (typed !== "REGENERATE") return;
    const res = await fetch(`/api/staff/${form.id}/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "REGENERATE" }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Failed");
    setForm((f) => ({ ...f, qrToken: data.staff.qrToken }));
    setMsg(data.warning || "QR regenerated");
  }

  async function printOne() {
    const res = await fetch("/api/staff/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [form.id], mode: "single" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error || "Print blocked");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.idNumber}-id-card.pdf`;
    a.click();
  }

  function downloadQr(format: "png" | "svg" = "png") {
    if (!form.id) return;
    const a = document.createElement("a");
    a.href = `/api/staff/${form.id}/qr/download?format=${format}`;
    a.download = `nsc-qr-${form.idNumber}.${format}`;
    a.click();
    setMsg(`QR ${format.toUpperCase()} download started`);
  }

  async function onFile(file: File) {
    // Downscale before cropping, never after: the crop box is in pixels of
    // whatever image the user cropped, so resizing later would misalign it.
    try {
      const normalized = await normalizePhoto(file);
      setRawFile(normalized.file);
      setCropSrc(normalized.dataUrl);
      if (normalized.resized) {
        const from = (normalized.originalBytes / 1024 / 1024).toFixed(1);
        const to = (normalized.file.size / 1024 / 1024).toFixed(1);
        setMsg(`Photo resized for upload (${from}MB → ${to}MB); print quality is unaffected.`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not read that image");
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

      // Ask for an upload signature. If Cloudinary is not configured (local
      // dev) this 501s and we fall back to posting the file to our own API.
      const signRes = await fetch(`/api/photos/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: form.id }),
      });

      let res: Response;
      if (signRes.ok) {
        const sign = await signRes.json();

        // The original goes browser -> Cloudinary directly. Routing it through
        // our API would exceed Vercel's 4.5 MB body limit and return 413.
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
          setMsg(`Upload to Cloudinary failed: ${detail.slice(0, 200)}`);
          return;
        }

        setProgress(60);

        // Only the crop box crosses our own API — a few hundred bytes.
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

      // A 413 comes from the platform, not the app, so the body is HTML and
      // res.json() would throw a misleading parse error instead of the cause.
      if (res.status === 413) {
        stopLoading();
        setMsg(
          "Photo too large for the server to accept. Cloudinary upload is not configured on this deployment.",
        );
        return;
      }

      const data = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        stopLoading();
        setMsg(data.error || `Photo save failed (${res.status})`);
        return;
      }

      setProgress(100);
      stopLoading();

      setForm((f) => ({ ...f, ...data.staff }));
      setCropSrc(null);
      setRawFile(null);
      setMsg(`✓ Photo saved (${Math.round(data.dpi)} dpi)`);
      router.refresh();
    } catch (error) {
      stopLoading();
      setMsg(error instanceof Error ? error.message : "Photo save failed");
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
      }
    } catch (err) {
      setMsg("Failed to load photo for editing");
    }
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-2 space-y-4 rounded-xl border border-neutral-200 bg-white p-4 md:order-1">
        <div>
          <h2 className="text-base font-semibold text-[#0d4720]">Edit staff details</h2>
          <p className="text-sm text-neutral-600">
            Changes update the live ID card preview as you type. Click Save when ready.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
            <label key={key} className="text-sm">
              <span className="text-neutral-600">{label}</span>
              <input
                className="mt-1 w-full rounded-md border px-2 py-1.5"
                value={(form[key] as string) ?? ""}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          {form.canMedical !== false && (
            <>
              <label className="text-sm">
                <span className="text-neutral-600">Blood group (admin only)</span>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5"
                  value={form.bloodGroup ?? ""}
                  onChange={(e) => set("bloodGroup", e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-neutral-600">Genotype (admin only)</span>
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5"
                  value={form.genotype ?? ""}
                  onChange={(e) => set("genotype", e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-neutral-600">Front template</span>
            <select
              className="mt-1 w-full rounded-md border px-2 py-1.5"
              value={form.frontTemplate}
              onChange={(e) => set("frontTemplate", e.target.value as FrontTemplateId)}
            >
              {Object.keys(FRONT_TEMPLATES).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-neutral-600">
              Back template
            </span>
            <select
              className="mt-1 w-full rounded-md border px-2 py-1.5"
              value={form.backTemplate}
              onChange={(e) => set("backTemplate", e.target.value as BackTemplateId)}
            >
              {Object.keys(BACK_TEMPLATES).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </div>
        {mismatch ? (
          <p className="text-sm text-amber-700">
            Warning: front/back colour families differ.
          </p>
        ) : null}

        {form.id ? (
          <div className="space-y-2">
            <label className="block text-sm">
              <span className="text-neutral-600">Photo (camera or file)</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-1 block w-full text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            {form.photoPreviewKey && (
              <button
                type="button"
                onClick={editPositioning}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit positioning (reopen cropper)
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Save the record before capturing a photo.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {form.id ? (
            <button
              type="button"
              onClick={() => {
                const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${form.qrToken}`;
                window.open(qrUrl, '_blank');
              }}
              className="rounded-md border border-blue-300 px-3 py-2 text-sm text-blue-700"
            >
              Preview QR Page
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-[#0d4720] px-3 py-2 text-sm text-white"
          >
            Save
          </button>
          {form.id && form.canApprove !== false ? (
            <button
              type="button"
              onClick={approve}
              className="rounded-md border border-[#0d4720] px-3 py-2 text-sm text-[#0d4720]"
            >
              Approve / publish
            </button>
          ) : null}
          {form.id && form.canPrint !== false ? (
            <button
              type="button"
              onClick={printOne}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Download PDF
            </button>
          ) : null}
          {form.id ? (
            <>
              <button
                type="button"
                onClick={() => downloadQr("png")}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Download QR (PNG)
              </button>
              <button
                type="button"
                onClick={() => downloadQr("svg")}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Download QR (SVG)
              </button>
            </>
          ) : null}
          {form.id && form.canSuspend !== false ? (
            <button
              type="button"
              onClick={() =>
                setStatus(form.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED")
              }
              className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700"
            >
              {form.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
            </button>
          ) : null}
          {form.id && form.canQr !== false ? (
            <button
              type="button"
              onClick={regenerateQr}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Regenerate QR
              {form.lastPrintedAt ? " (was printed)" : ""}
            </button>
          ) : null}
        </div>
        {msg ? <p className="text-sm text-neutral-600">{msg}</p> : null}
        {form.hasPendingEdits ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Changes awaiting approval — printing blocked until published.
          </p>
        ) : null}
      </div>

      <aside className="order-1 space-y-3 md:sticky md:top-4 md:order-2">
        <div className="rounded-xl border border-[#0d4720]/20 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#0d4720]">Live ID card</h2>
              <p className="text-xs text-neutral-500">Updates as you edit</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSide("front")}
                className={`rounded-md px-2 py-1 text-xs ${side === "front" ? "bg-[#0d4720] text-white" : "border"}`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setSide("back")}
                className={`rounded-md px-2 py-1 text-xs ${side === "back" ? "bg-[#0d4720] text-white" : "border"}`}
              >
                Back
              </button>
            </div>
          </div>
          <div className="flex max-h-[70vh] justify-center overflow-auto rounded-lg bg-neutral-100 p-3">
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
          {form.id ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => downloadQr("png")}
                className="rounded border px-2 py-1 text-neutral-700 hover:bg-neutral-50"
              >
                QR PNG
              </button>
              <button
                type="button"
                onClick={() => downloadQr("svg")}
                className="rounded border px-2 py-1 text-neutral-700 hover:bg-neutral-50"
              >
                QR SVG
              </button>
            </div>
          ) : null}
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
    </div>
  );
}
