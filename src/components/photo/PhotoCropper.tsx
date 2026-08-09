"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { detectFaceSimple, type FaceDetectionResult } from "@/lib/photo/face-detect";

type Props = {
  imageSrc: string;
  frontTemplate: FrontTemplateId;
  onCancel: () => void;
  onSave: (crop: Area, zoom: number) => Promise<void>;
  initialCrop?: { x: number; y: number; width: number; height: number; zoom?: number };
};

function dpiFromArea(area: Area | null) {
  if (!area) return 0;
  return Math.min(
    area.width / PHOTO_SLOT_INCHES.width,
    area.height / PHOTO_SLOT_INCHES.height,
  );
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

  // Editing state
  const [crop, setCrop] = useState(
    initialCrop
      ? { x: initialCrop.x, y: initialCrop.y }
      : { x: 0, y: (0.5 - faceHint.eyeLineFromTop) * 40 }
  );
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1.4);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Phase 1: Image adjustments
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(4 / 5);

  // Undo/Redo history
  type HistoryState = { rotation: number; brightness: number; contrast: number; crop: typeof crop; zoom: number; aspect: number | undefined };
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const minPx = useMemo(
    () => ({
      w: Math.ceil(PHOTO_SLOT_INCHES.width * PHOTO_DPI_FLOOR),
      h: Math.ceil(PHOTO_SLOT_INCHES.height * PHOTO_DPI_FLOOR),
    }),
    [],
  );

  const dpi = dpiFromArea(area);
  const maxZoom = useMemo(() => {
    // Cap zoom so crop source pixels stay above floor — approximate from natural size unknown;
    // react-easy-crop gives pixel area in onCropComplete.
    return 4;
  }, []);

  // ============ UNDO/REDO LOGIC ============
  const currentState = useMemo<HistoryState>(() => ({
    rotation,
    brightness,
    contrast,
    crop,
    zoom,
    aspect: aspectRatio,
  }), [rotation, brightness, contrast, crop, zoom, aspectRatio]);

  const addToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, currentState]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setRotation(prevState.rotation);
      setBrightness(prevState.brightness);
      setContrast(prevState.contrast);
      setCrop(prevState.crop);
      setZoom(prevState.zoom);
      setAspectRatio(prevState.aspect);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setRotation(nextState.rotation);
      setBrightness(nextState.brightness);
      setContrast(nextState.contrast);
      setCrop(nextState.crop);
      setZoom(nextState.zoom);
      setAspectRatio(nextState.aspect);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  const onCropComplete = useCallback((_a: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const meterColor =
    dpi < PHOTO_DPI_FLOOR
      ? "bg-red-500"
      : dpi < PHOTO_DPI_TARGET
        ? "bg-amber-500"
        : "bg-emerald-600";

  const previewW = Math.round(PHOTO_SLOT_INCHES.width * 96 * 3);
  const previewH = Math.round(PHOTO_SLOT_INCHES.height * 96 * 3);

  // Phase 3: File size estimation
  const estimatedFileSize = useMemo(() => {
    if (!area) return 0;
    // Estimate based on print resolution (600 dpi)
    const printW = Math.round(area.width * (600 / dpi));
    const printH = Math.round(area.height * (600 / dpi));
    // Rough: 960×1200px JPEG at quality 92 ≈ 150KB
    const pixelCount = (printW * printH) / (960 * 1200);
    return Math.max(50, Math.round(150 * pixelCount));
  }, [area, dpi]);

  // Phase 3: Crop templates (localStorage)
  const [templates, setTemplates] = useState<Array<{ name: string; data: typeof currentState }>>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    // Load templates from localStorage
    try {
      const saved = localStorage.getItem("photoTemplates");
      if (saved) setTemplates(JSON.parse(saved));
    } catch {
      // Ignore load errors
    }
  }, []);

  const saveTemplate = useCallback((name: string) => {
    const newTemplate = { name, data: currentState };
    const updated = [...templates.filter(t => t.name !== name), newTemplate];
    setTemplates(updated);
    localStorage.setItem("photoTemplates", JSON.stringify(updated));
  }, [templates, currentState]);

  const loadTemplate = useCallback((template: typeof templates[0]) => {
    addToHistory();
    setRotation(template.data.rotation);
    setBrightness(template.data.brightness);
    setContrast(template.data.contrast);
    setCrop(template.data.crop);
    setZoom(template.data.zoom);
    setAspectRatio(template.data.aspect);
  }, [addToHistory]);

  // ============ AUTO-DETECTION FUNCTIONS ============
  const autoRotatePortrait = useCallback(() => {
    // Attempt to detect if image is landscape and rotate to portrait
    const img = new Image();
    img.onload = () => {
      if (img.width > img.height) {
        setRotation(r => {
          addToHistory();
          return r + 90;
        });
      }
    };
    img.src = imageSrc;
  }, [imageSrc, addToHistory]);

  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faceData, setFaceData] = useState<FaceDetectionResult | null>(null);

  const autoFaceCenter = useCallback(async () => {
    setFaceDetecting(true);
    try {
      const result = await detectFaceSimple(imageSrc);
      setFaceData(result);

      if (result.detected) {
        addToHistory();
        // Center the crop on the detected face
        const imgW = 4000; // approximate working space
        const imgH = 5000;

        setCrop({
          x: (result.centerX * imgW) - (result.width * imgW) / 2,
          y: (result.centerY * imgH) - (result.height * imgH) / 2,
        });

        // Auto-zoom to fill frame
        setZoom(Math.min(2.5, maxZoom * 0.8));
      }
    } finally {
      setFaceDetecting(false);
    }
  }, [imageSrc, addToHistory, maxZoom]);

  const autoZoomToFace = useCallback(() => {
    // Auto-zoom to fill frame while maintaining quality
    addToHistory();
    setZoom(Math.min(2.5, maxZoom * 0.8)); // Fill frame without being extreme
  }, [addToHistory, maxZoom]);

  const resetAdjustments = useCallback(() => {
    addToHistory();
    setRotation(0);
    setBrightness(100);
    setContrast(100);
  }, [addToHistory]);

  async function handleSave() {
    if (!area || dpi < PHOTO_DPI_FLOOR) return;
    setSaving(true);
    try {
      await onSave(area, zoom);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="flex max-h-screen w-full max-w-7xl flex-col rounded-lg bg-white shadow-xl sm:flex-row sm:rounded-xl">
        {/* Left: Cropper */}
        <div className="flex flex-1 flex-col overflow-auto p-3 sm:p-4">
          <h3 className="mb-2 text-base font-semibold text-[#0d4720] sm:text-lg">
            Crop staff photo (4:5)
          </h3>
          <p className="mb-3 text-xs text-neutral-600 sm:text-sm">
            Eyes ~{Math.round(FACE_FRAMING.eyeLineFromTop * 100)}% from top.{" "}
            {mask === "circle" ? "Circle" : "Rounded square"} mask.
          </p>

          {/* Loading spinner */}
          {!area && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-[#0d4720]" />
                <p className="text-xs text-neutral-600 sm:text-sm">Loading crop area...</p>
              </div>
            </div>
          )}

          <div className="relative flex-1 overflow-hidden rounded-lg bg-neutral-900" style={{ minHeight: "280px" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio ?? 4 / 5}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            maxZoom={maxZoom}
            showGrid={false}
            style={{ containerStyle: { filter: `brightness(${brightness}%) contrast(${contrast}%)` } }}
          />
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            {/* Circle masks are round (inscribed in the 4:5 crop); square templates use rounded rect */}
            <div
              className="border-2 border-white/70 bg-transparent"
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

          {/* UNDO/REDO BUTTONS */}
          <div className="mt-3 flex gap-2 border-b pb-3">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="flex-1 flex items-center justify-center gap-1 rounded bg-gray-200 px-2 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-gray-300"
            >
              ↶ Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="flex-1 flex items-center justify-center gap-1 rounded bg-gray-200 px-2 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-gray-300"
            >
              ↷ Redo
            </button>
            <button
              onClick={resetAdjustments}
              className="flex-1 rounded bg-blue-100 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
              title="Reset rotation, brightness, contrast"
            >
              Reset
            </button>
          </div>

          {/* ZOOM SLIDER */}
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600 sm:text-sm">Zoom</label>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={1}
                  max={maxZoom}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-neutral-600 w-12 text-right">{zoom.toFixed(2)}</span>
              </div>
            </div>

            {/* ROTATION SLIDER */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600 sm:text-sm">Rotate</label>
              <div className="flex gap-2 items-center">
                <button onClick={() => setRotation(r => r - 5)} className="px-2 py-1 bg-gray-200 rounded text-xs">-5°</button>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="flex-1"
                />
                <button onClick={() => setRotation(r => r + 5)} className="px-2 py-1 bg-gray-200 rounded text-xs">+5°</button>
                <span className="text-xs font-mono w-10 text-right">{rotation}°</span>
              </div>
            </div>

            {/* BRIGHTNESS SLIDER */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600 sm:text-sm">Brightness</label>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={50}
                  max={150}
                  step={1}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-10 text-right">{brightness}%</span>
              </div>
            </div>

            {/* CONTRAST SLIDER */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600 sm:text-sm">Contrast</label>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={50}
                  max={150}
                  step={1}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-10 text-right">{contrast}%</span>
              </div>
            </div>

            {/* ASPECT RATIO BUTTONS */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600 sm:text-sm">Aspect Ratio</label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: "4:5", value: 4 / 5 },
                  { label: "1:1", value: 1 },
                  { label: "3:2", value: 3 / 2 },
                  { label: "16:9", value: 16 / 9 },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => setAspectRatio(value)}
                    className={`py-1 rounded text-xs font-medium transition-colors ${
                      aspectRatio && Math.abs(aspectRatio - value) < 0.01
                        ? "bg-[#0d4720] text-white"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* AUTO-DETECTION BUTTONS */}
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-neutral-600 mb-2">Auto-Detect</p>
              <div className="space-y-2">
                <button
                  onClick={autoRotatePortrait}
                  disabled={faceDetecting}
                  className="w-full py-1.5 rounded bg-purple-100 text-xs font-medium text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                >
                  🔄 Auto-Rotate Portrait
                </button>
                <button
                  onClick={autoFaceCenter}
                  disabled={faceDetecting}
                  className="w-full py-1.5 rounded bg-purple-100 text-xs font-medium text-purple-700 hover:bg-purple-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {faceDetecting ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-purple-700" />
                      Detecting...
                    </>
                  ) : (
                    <>👤 Auto-Center Face</>
                  )}
                </button>
                {faceData?.detected && (
                  <p className="text-xs text-green-600">✓ Face detected ({Math.round(faceData.confidence * 100)}%)</p>
                )}
              </div>
            </div>

            {/* DPI INFO */}
            <div className="flex items-center gap-2 border-t pt-3">
              <span className={`h-2 w-2 rounded-full ${meterColor}`} />
              <span className="text-xs font-mono text-neutral-600">
                {Math.round(dpi)} dpi (target {PHOTO_DPI_TARGET})
              </span>
            </div>
          </div>

          {dpi > 0 && dpi < PHOTO_DPI_FLOOR && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 sm:text-sm">
              <span>⚠️</span>
              <p>Below {PHOTO_DPI_FLOOR} dpi. Zoom in or use higher resolution.</p>
            </div>
          )}
        </div>

        {/* Right: Preview Panel */}
        <div className="w-full border-t sm:border-l sm:border-t-0 sm:w-72 p-3 sm:p-4 overflow-auto bg-neutral-50 flex flex-col">
          {area ? (
            <>
              <div className="mb-3">
                <p className="text-xs font-semibold text-neutral-600 sm:text-sm">
                  Card Preview (3×)
                </p>
                <p className="text-xs text-neutral-500">
                  {(PHOTO_SLOT_INCHES.width * 2.54).toFixed(1)}cm × {(PHOTO_SLOT_INCHES.height * 2.54).toFixed(1)}cm
                </p>
              </div>

              {/* Responsive preview size */}
              <div
                className="mx-auto flex items-center justify-center bg-white ring-1 ring-neutral-300 mb-3 shrink-0"
                style={{
                  width: Math.min(previewW, 200),
                  height: Math.min(previewH, 250),
                  overflow: "hidden",
                  position: "relative"
                }}
              >
                {/* Loading spinner while preview renders */}
                {!area && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-[#0d4720]" />
                  </div>
                )}
                <img
                  src={imageSrc}
                  alt="preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "none",
                    objectPosition: `${-area.x}px ${-area.y}px`,
                    transform: `scale(${96 / dpi || 1})`,
                    transformOrigin: "top left",
                  }}
                />
                {/* Eyes line */}
                <div style={{ position: "absolute", top: `${FACE_FRAMING.eyeLineFromTop * 100}%`, left: 0, right: 0, height: "1px", backgroundColor: "rgba(59, 130, 246, 0.4)", pointerEvents: "none" }} />
                {/* Center */}
                <div style={{ position: "absolute", top: 0, left: "50%", bottom: 0, width: "1px", backgroundColor: "rgba(107, 114, 128, 0.2)", pointerEvents: "none" }} />
                {/* Safe zone */}
                <div style={{ position: "absolute", top: `${(FACE_FRAMING.eyeLineFromTop - FACE_FRAMING.faceHeightRatio / 2) * 100}%`, left: 0, right: 0, height: `${FACE_FRAMING.faceHeightRatio * 100}%`, border: "1px dashed rgba(34, 197, 94, 0.3)", pointerEvents: "none" }} />
              </div>

              {/* Dimensions & File Size */}
              <div className="space-y-1 text-xs text-neutral-600 mb-3 border-b pb-3">
                <p className="font-mono">{Math.round(area.width)}×{Math.round(area.height)}px</p>
                <p className="font-mono">{Math.round(dpi)} dpi</p>
                <p className="font-mono text-blue-600">📦 ~{estimatedFileSize}KB</p>
              </div>

              {/* Status */}
              {dpi > PHOTO_DPI_TARGET && (
                <p className="text-xs text-amber-600 mb-2">⚠️ High DPI - zoom out to reduce size</p>
              )}
              {dpi < PHOTO_DPI_FLOOR && (
                <p className="text-xs text-red-600 mb-2">❌ Below minimum DPI</p>
              )}
              {dpi >= PHOTO_DPI_FLOOR && dpi <= PHOTO_DPI_TARGET && (
                <p className="text-xs text-emerald-600 mb-2">✓ Perfect for print</p>
              )}

              {/* Templates */}
              <div className="mt-3 border-t pt-3">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="w-full py-1.5 rounded bg-blue-100 text-xs font-medium text-blue-700 hover:bg-blue-200 mb-2"
                >
                  💾 {showTemplates ? "Hide" : "Show"} Templates
                </button>
                {showTemplates && (
                  <div className="space-y-1.5 mb-2">
                    {templates.length > 0 ? (
                      <>
                        {templates.map((t, i) => (
                          <button
                            key={i}
                            onClick={() => loadTemplate(t)}
                            className="block w-full p-1 text-left text-xs bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            📋 {t.name}
                          </button>
                        ))}
                        <hr className="my-1" />
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 mb-2">No templates yet</p>
                    )}
                    <input
                      type="text"
                      placeholder="Template name..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value) {
                          saveTemplate(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border rounded"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-neutral-200 border-t-[#0d4720] mb-2" />
              <p className="text-xs text-neutral-500">Analyzing crop...</p>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-auto flex gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-md px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !area || dpi < PHOTO_DPI_FLOOR}
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-[#0d4720] px-3 py-2 text-xs font-medium text-white disabled:opacity-40 sm:text-sm"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving…</span>
                </>
              ) : (
                "Save photo"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
