"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type MediaSize, type Size as CropSize } from "react-easy-crop";
import {
  FACE_FRAMING,
  FRONT_TEMPLATES,
  PHOTO_DPI_FLOOR,
  PHOTO_DPI_TARGET,
  PHOTO_SLOT_INCHES,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { detectFaceSimple } from "@/lib/photo/face-detect";
import { rotatedBounds } from "@/lib/photo/card-crop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { monoFont } from "@/theme/mui-theme";

export type SavedCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom?: number;
  rotation?: number;
};

type Props = {
  imageSrc: string;
  frontTemplate: FrontTemplateId;
  onCancel: () => void;
  onSave: (crop: Area, zoom: number, rotation: number) => Promise<void>;
  /**
   * The crop box last saved for *this same image*, in its pixels. Restores the
   * exact framing on reopen. Omit for a newly chosen photo.
   */
  initialCrop?: SavedCrop;
};

/** ID cards always use the 4:5 portrait slot — do not offer other ratios. */
const CARD_ASPECT = 4 / 5;
const DEFAULT_ZOOM = 1.2;
const MAX_ZOOM = 4;
const PREVIEW_W = 150;

function dpiFromArea(area: Area | null) {
  if (!area) return 0;
  return Math.min(area.width / PHOTO_SLOT_INCHES.width, area.height / PHOTO_SLOT_INCHES.height);
}

function dpiColor(dpi: number): "error" | "warning" | "success" | "default" {
  if (!dpi) return "default";
  if (dpi < PHOTO_DPI_FLOOR) return "error";
  if (dpi < PHOTO_DPI_TARGET) return "warning";
  return "success";
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Draw exactly what the server will cut: rotate the original about its centre
 * inside its rotated bounding box, then take `area` from that box.
 */
function drawPreview(canvas: HTMLCanvasElement, img: HTMLImageElement, area: Area, rotation: number) {
  const dpr = window.devicePixelRatio || 1;
  const w = PREVIEW_W;
  const h = Math.round(PREVIEW_W / CARD_ASPECT);
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const s = (w / area.width) * dpr;
  const natural = { w: img.naturalWidth, h: img.naturalHeight };
  const bounds = rotatedBounds(natural, rotation);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(s, 0, 0, s, -area.x * s, -area.y * s);
  ctx.translate(bounds.w / 2, bounds.h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -natural.w / 2, -natural.h / 2);
}

export function PhotoCropper({ imageSrc, frontTemplate, onCancel, onSave, initialCrop }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const mask = FRONT_TEMPLATES[frontTemplate].photoMask;
  const eyeLine = FACE_FRAMING.eyeLineFromTop;

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? DEFAULT_ZOOM);
  const [rotation, setRotation] = useState(initialCrop?.rotation ?? 0);
  const [area, setArea] = useState<Area | null>(null);
  const [media, setMedia] = useState<MediaSize | null>(null);
  const [cropSize, setCropSize] = useState<CropSize | null>(null);
  const [saving, setSaving] = useState(false);
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faceMsg, setFaceMsg] = useState<string | null>(null);
  // Bumping this remounts the Cropper so "Reset" can re-apply initial framing.
  const [resetKey, setResetKey] = useState(0);
  const [useInitial, setUseInitial] = useState(Boolean(initialCrop));

  const previewRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef(0);

  const dpi = dpiFromArea(area);
  const canSave = Boolean(area) && dpi >= PHOTO_DPI_FLOOR && !saving;

  // One decoded copy of the image for the live preview canvas.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setArea((a) => (a ? { ...a } : a)); // trigger a first draw
    };
    img.src = imageSrc;
    return () => {
      imgRef.current = null;
    };
  }, [imageSrc]);

  // Redraw at most once per frame while dragging.
  useEffect(() => {
    if (!area) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = previewRef.current;
      const img = imgRef.current;
      if (canvas && img) drawPreview(canvas, img, area, rotation);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [area, rotation]);

  const onCropComplete = useCallback((_a: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  /** Keep the media covering the crop box (react-easy-crop only enforces this on drag). */
  const clampPosition = useCallback(
    (pos: { x: number; y: number }, z: number) => {
      if (!media || !cropSize) return pos;
      const maxX = Math.max(0, (media.width * z - cropSize.width) / 2);
      const maxY = Math.max(0, (media.height * z - cropSize.height) / 2);
      return { x: clamp(pos.x, -maxX, maxX), y: clamp(pos.y, -maxY, maxY) };
    },
    [media, cropSize],
  );

  const autoFaceCenter = useCallback(async () => {
    if (!media || !cropSize) return;
    setFaceDetecting(true);
    setFaceMsg(null);
    try {
      const face = await detectFaceSimple(imageSrc);
      if (!face.detected) {
        setFaceMsg("No face found — drag to position it.");
        return;
      }
      // Size the face to the card's framing, then put the eyes on the guide line.
      const faceH = face.height * media.height;
      const z = clamp((FACE_FRAMING.faceHeightRatio * cropSize.height) / faceH, 1, 2.5);
      const eyesY = face.centerY - face.height * 0.15;
      const target = clampPosition(
        {
          x: (0.5 - face.centerX) * media.width * z,
          y: (eyeLine - 0.5) * cropSize.height - (eyesY - 0.5) * media.height * z,
        },
        z,
      );
      setRotation(0);
      setZoom(z);
      setCrop(target);
      setFaceMsg("Face centred — fine-tune by dragging.");
    } finally {
      setFaceDetecting(false);
    }
  }, [imageSrc, media, cropSize, clampPosition, eyeLine]);

  function reset() {
    setFaceMsg(null);
    setRotation(initialCrop?.rotation ?? 0);
    setZoom(initialCrop?.zoom ?? DEFAULT_ZOOM);
    setCrop({ x: 0, y: 0 });
    setUseInitial(Boolean(initialCrop));
    setResetKey((k) => k + 1);
  }

  async function handleSave() {
    if (!area || dpi < PHOTO_DPI_FLOOR) return;
    setSaving(true);
    try {
      await onSave(area, zoom, rotation);
    } finally {
      setSaving(false);
    }
  }

  const rotateBy = (d: number) => setRotation((r) => clamp(r + d, -45, 45));

  const circleSize = cropSize ? Math.min(cropSize.width, cropSize.height) : 0;

  return (
    <Dialog
      open
      fullScreen={fullScreen}
      onClose={() => {
        if (!saving) onCancel();
      }}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            maxHeight: fullScreen ? "100%" : "min(94vh, 820px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5, pr: 7 }}>
        Position photo
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Drag to move · scroll or pinch to zoom · eyes on the dotted line
        </Typography>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 220px" },
          minHeight: 0,
          flex: 1,
          overflow: "auto",
        }}
      >
        <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 }, minHeight: 0, minWidth: 0 }}>
          {/* Stage */}
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 3,
              bgcolor: "#0b0d12",
              height: { xs: "min(56vh, 440px)", md: "min(54vh, 460px)" },
              minHeight: 260,
              touchAction: "none",
            }}
          >
            <Cropper
              key={resetKey}
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={CARD_ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              onMediaLoaded={setMedia}
              onCropSizeChange={setCropSize}
              initialCroppedAreaPixels={useInitial ? initialCrop : undefined}
              onInteractionStart={() => setUseInitial(false)}
              minZoom={1}
              maxZoom={MAX_ZOOM}
              zoomSpeed={0.6}
              showGrid={false}
              style={{
                cropAreaStyle: {
                  border: "2px solid rgba(255,255,255,0.9)",
                  borderRadius: mask === "circle" ? 0 : 10,
                  color: "rgba(8,10,14,0.62)",
                },
                mediaStyle: { transition: "opacity 200ms ease", opacity: media ? 1 : 0 },
              }}
            />

            {!media ? (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                <CircularProgress color="inherit" size={28} />
              </Box>
            ) : null}

            {/* Guides aligned to the real crop box */}
            {cropSize ? (
              <Box
                aria-hidden
                className="nsc-anim-fade"
                sx={{
                  pointerEvents: "none",
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: cropSize.width,
                  height: cropSize.height,
                  transform: "translate(-50%, -50%)",
                  overflow: "hidden",
                }}
              >
                {mask === "circle" ? (
                  <Box
                    sx={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: circleSize,
                      height: circleSize,
                      transform: "translate(-50%, -50%)",
                      borderRadius: "50%",
                      border: "1.5px dashed rgba(255,255,255,0.85)",
                      boxShadow: "0 0 0 9999px rgba(8,10,14,0.28)",
                    }}
                  />
                ) : null}
                <Box
                  sx={{
                    position: "absolute",
                    insetInline: 0,
                    top: `${eyeLine * 100}%`,
                    borderTop: "1.5px dotted rgba(56,189,248,0.95)",
                  }}
                />
              </Box>
            ) : null}
          </Box>

          {/* Controls */}
          <Box
            sx={{
              display: "grid",
              gap: { xs: 1.5, sm: 3 },
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            }}
          >
            <Box>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }} id="crop-zoom">
                  Zoom
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFont }}>
                  {zoom.toFixed(2)}×
                </Typography>
              </Stack>
              <Slider
                aria-labelledby="crop-zoom"
                size="small"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(_, v) => setZoom(v as number)}
              />
            </Box>
            <Box>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }} id="crop-rotate">
                  Straighten
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFont }}>
                  {rotation > 0 ? "+" : ""}
                  {rotation}°
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Tooltip title="Rotate −1°">
                  <IconButton size="small" onClick={() => rotateBy(-1)} aria-label="Rotate left 1 degree">
                    <span aria-hidden>↺</span>
                  </IconButton>
                </Tooltip>
                <Slider
                  aria-labelledby="crop-rotate"
                  size="small"
                  min={-45}
                  max={45}
                  step={0.5}
                  value={rotation}
                  track={false}
                  marks={[{ value: 0 }]}
                  onChange={(_, v) => setRotation(v as number)}
                  onDoubleClick={() => setRotation(0)}
                />
                <Tooltip title="Rotate +1°">
                  <IconButton size="small" onClick={() => rotateBy(1)} aria-label="Rotate right 1 degree">
                    <span aria-hidden>↻</span>
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              disabled={faceDetecting || !media}
              onClick={autoFaceCenter}
              startIcon={faceDetecting ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {faceDetecting ? "Finding face…" : "Auto-center face"}
            </Button>
            <Button size="small" variant="text" onClick={reset} disabled={saving}>
              Reset
            </Button>
            {faceMsg ? (
              <Typography variant="caption" color="text.secondary" className="nsc-anim-fade">
                {faceMsg}
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        {/* Side panel: preview + print quality */}
        <Stack
          spacing={2}
          sx={{
            p: 2.5,
            bgcolor: "var(--md-surface-container-low)",
            borderLeft: { md: 1 },
            borderTop: { xs: 1, md: 0 },
            borderColor: "divider",
            flexDirection: { xs: "row", md: "column" },
            alignItems: { xs: "center", md: "stretch" },
            gap: { xs: 2, md: 0 },
          }}
        >
          <Box
            sx={{
              position: "relative",
              mx: { md: "auto" },
              flexShrink: 0,
              overflow: "hidden",
              bgcolor: "#fff",
              boxShadow: "0 0 0 1px var(--md-outline-variant), var(--md-elevation-1)",
              width: { xs: 96, md: PREVIEW_W },
              height: mask === "circle" ? { xs: 96, md: PREVIEW_W } : { xs: 120, md: PREVIEW_W / CARD_ASPECT },
              borderRadius: mask === "circle" ? "50%" : 2.5,
            }}
          >
            <canvas
              ref={previewRef}
              aria-label="Card photo preview"
              style={{
                position: "absolute",
                left: 0,
                width: "100%",
                // Circle frames show the centre of the 4:5 cut, like the card.
                top: mask === "circle" ? "-12.5%" : 0,
                height: mask === "circle" ? "125%" : "100%",
                opacity: area ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
            />
          </Box>

          <Stack spacing={1} sx={{ mt: { md: 2 }, minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" sx={{ display: { xs: "none", md: "block" } }}>
              On the card
            </Typography>
            <Divider sx={{ display: { xs: "none", md: "block" } }} />
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Print quality
              </Typography>
              <Chip size="small" color={dpiColor(dpi)} label={dpi ? `${Math.round(dpi)} dpi` : "—"} />
            </Stack>
            <Typography
              variant="caption"
              sx={{ minHeight: 32 }}
              color={
                !dpi
                  ? "text.secondary"
                  : dpi < PHOTO_DPI_FLOOR
                    ? "error"
                    : dpi < PHOTO_DPI_TARGET
                      ? "warning.main"
                      : "success.main"
              }
            >
              {!dpi
                ? "Loading photo…"
                : dpi < PHOTO_DPI_FLOOR
                  ? `Too low to print — zoom out or use a sharper photo (min ${PHOTO_DPI_FLOOR}).`
                  : dpi < PHOTO_DPI_TARGET
                    ? `Acceptable. ${PHOTO_DPI_TARGET} dpi prints best.`
                    : "Sharp enough for print."}
            </Typography>
            {area ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFont }}>
                {Math.round(area.width)}×{Math.round(area.height)} px
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 1 }}>
        <Button variant="text" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={handleSave}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? "Saving…" : "Save photo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
