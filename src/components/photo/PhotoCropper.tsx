"use client";

import { useCallback, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  FACE_FRAMING,
  FRONT_TEMPLATES,
  PHOTO_DPI_FLOOR,
  PHOTO_DPI_TARGET,
  PHOTO_SLOT_INCHES,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { fallbackFaceHint } from "@/lib/photo/face-center";
import { detectFaceSimple } from "@/lib/photo/face-detect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  imageSrc: string;
  frontTemplate: FrontTemplateId;
  onCancel: () => void;
  onSave: (crop: Area, zoom: number) => Promise<void>;
  initialCrop?: { x: number; y: number; width: number; height: number; zoom?: number };
};

/** ID cards always use the 4:5 portrait slot — do not offer other ratios. */
const CARD_ASPECT = 4 / 5;

function dpiFromArea(area: Area | null) {
  if (!area) return 0;
  return Math.min(
    area.width / PHOTO_SLOT_INCHES.width,
    area.height / PHOTO_SLOT_INCHES.height,
  );
}

function dpiBadgeVariant(dpi: number): "error" | "warning" | "success" | "default" {
  if (!dpi) return "default";
  if (dpi < PHOTO_DPI_FLOOR) return "error";
  if (dpi < PHOTO_DPI_TARGET) return "warning";
  return "success";
}

export function PhotoCropper({
  imageSrc,
  frontTemplate,
  onCancel,
  onSave,
  initialCrop,
}: Props) {
  const mask = FRONT_TEMPLATES[frontTemplate].photoMask;
  const faceHint = fallbackFaceHint();

  const [crop, setCrop] = useState(
    initialCrop
      ? { x: initialCrop.x, y: initialCrop.y }
      : { x: 0, y: (0.5 - faceHint.eyeLineFromTop) * 40 },
  );
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1.35);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faceMsg, setFaceMsg] = useState<string | null>(null);

  const maxZoom = 4;
  const dpi = dpiFromArea(area);
  const canSave = Boolean(area) && dpi >= PHOTO_DPI_FLOOR && !saving;

  const onCropComplete = useCallback((_a: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const autoFaceCenter = useCallback(async () => {
    setFaceDetecting(true);
    setFaceMsg(null);
    try {
      const result = await detectFaceSimple(imageSrc);
      if (!result.detected) {
        setFaceMsg("No face found — drag to position manually.");
        return;
      }
      setCrop({
        x: (result.centerX - 0.5) * 80,
        y: (result.centerY - faceHint.eyeLineFromTop) * 80,
      });
      setZoom(Math.min(2.2, maxZoom * 0.7));
      setFaceMsg(`Face found (${Math.round(result.confidence * 100)}% confidence)`);
    } finally {
      setFaceDetecting(false);
    }
  }, [imageSrc, faceHint.eyeLineFromTop]);

  async function handleSave() {
    if (!area || dpi < PHOTO_DPI_FLOOR) return;
    setSaving(true);
    try {
      await onSave(area, zoom);
    } finally {
      setSaving(false);
    }
  }

  const previewBox = useMemo(() => {
    const w = Math.min(Math.round(PHOTO_SLOT_INCHES.width * 96 * 2.4), 168);
    const h = Math.min(Math.round(PHOTO_SLOT_INCHES.height * 96 * 2.4), 210);
    return { w, h };
  }, []);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={!saving}
        className="flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b px-4 py-3 sm:px-5">
          <DialogTitle className="md-headline-small">
            Position staff photo
          </DialogTitle>
          <DialogDescription>
            Drag to frame the face. Eyes should sit near the guide line
            (~{Math.round(FACE_FRAMING.eyeLineFromTop * 100)}% from top). Mask:{" "}
            {mask === "circle" ? "circle" : "rounded square"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex min-h-0 flex-col gap-3 overflow-auto p-4 sm:p-5">
            <div
              className="relative overflow-hidden rounded-xl bg-neutral-950"
              style={{ minHeight: 280, height: "min(52vh, 420px)" }}
            >
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={CARD_ASPECT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                maxZoom={maxZoom}
                showGrid={false}
              />
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden
              >
                <div
                  className="border-2 border-white/80 bg-transparent"
                  style={
                    mask === "circle"
                      ? {
                          width: "72%",
                          aspectRatio: "1",
                          borderRadius: "50%",
                          boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                        }
                      : {
                          width: "72%",
                          height: "90%",
                          borderRadius: 16,
                          boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                        }
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="crop-zoom">Zoom</Label>
                  <span className="font-mono text-xs text-muted-foreground">
                    {zoom.toFixed(2)}×
                  </span>
                </div>
                <Slider
                  id="crop-zoom"
                  min={1}
                  max={maxZoom}
                  step={0.05}
                  value={[zoom]}
                  onValueChange={(v) => {
                    const next = Array.isArray(v) ? v[0] : v;
                    setZoom(next ?? 1);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="crop-rotate">Rotate</Label>
                  <span className="font-mono text-xs text-muted-foreground">
                    {rotation}°
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRotation((r) => Math.max(-45, r - 5))}
                  >
                    −5°
                  </Button>
                  <Slider
                    id="crop-rotate"
                    className="flex-1"
                    min={-45}
                    max={45}
                    step={1}
                    value={[rotation]}
                    onValueChange={(v) => {
                      const next = Array.isArray(v) ? v[0] : v;
                      setRotation(next ?? 0);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRotation((r) => Math.min(45, r + 5))}
                  >
                    +5°
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={faceDetecting}
                  onClick={autoFaceCenter}
                >
                  {faceDetecting ? "Detecting…" : "Auto-center face"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRotation(0);
                    setZoom(1.35);
                    setCrop({ x: 0, y: (0.5 - faceHint.eyeLineFromTop) * 40 });
                    setFaceMsg(null);
                  }}
                >
                  Reset
                </Button>
              </div>
              {faceMsg ? (
                <p className="text-xs text-muted-foreground">{faceMsg}</p>
              ) : null}
            </div>
          </div>

          <aside className="flex flex-col gap-3 border-t bg-muted/40 p-4 md:border-t-0 md:border-l">
            <div>
              <p className="md-title-small">
                Card preview
              </p>
              <p className="text-xs text-muted-foreground">
                {(PHOTO_SLOT_INCHES.width * 2.54).toFixed(1)} ×{" "}
                {(PHOTO_SLOT_INCHES.height * 2.54).toFixed(1)} cm · 4:5
              </p>
            </div>

            <div
              className="relative mx-auto overflow-hidden bg-white shadow-sm ring-1 ring-border"
              style={{
                width: previewBox.w,
                height: previewBox.h,
                borderRadius: mask === "circle" ? "50%" : 12,
              }}
            >
              {area ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "none",
                    objectPosition: `${-area.x}px ${-area.y}px`,
                    transform: `scale(${previewBox.w / area.width})`,
                    transformOrigin: "top left",
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Loading…
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-sky-400/70"
                style={{ top: `${FACE_FRAMING.eyeLineFromTop * 100}%` }}
              />
            </div>

            <Separator />

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Print DPI</span>
                <Badge variant={dpiBadgeVariant(dpi)}>
                  {dpi ? `${Math.round(dpi)} dpi` : "—"}
                </Badge>
              </div>
              {area ? (
                <p className="font-mono text-muted-foreground">
                  {Math.round(area.width)}×{Math.round(area.height)} px
                </p>
              ) : null}
              {dpi > 0 && dpi < PHOTO_DPI_FLOOR ? (
                <p className="text-red-600">
                  Below {PHOTO_DPI_FLOOR} dpi — zoom in or use a sharper photo.
                </p>
              ) : null}
              {dpi >= PHOTO_DPI_FLOOR && dpi < PHOTO_DPI_TARGET ? (
                <p className="text-amber-700">
                  Acceptable. Target is {PHOTO_DPI_TARGET} dpi for best print.
                </p>
              ) : null}
              {dpi >= PHOTO_DPI_TARGET ? (
                <p className="text-emerald-700">Good for print.</p>
              ) : null}
            </div>

            <DialogFooter className="mt-auto flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                className="w-full"
                disabled={!canSave}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save photo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={saving}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </DialogFooter>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
