# MediaPipe Face Detector (self-hosted)

On-premise installs must not load WASM/models from a CDN.

Download and place:

- `wasm/` runtime files from `@mediapipe/tasks-vision`
- `blaze_face_short_range.tflite` (or the `.task` bundle your version expects)

Wire paths in the photo cropper face-auto-center step to these local files.
