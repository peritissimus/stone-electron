/**
 * Disable ONNX Runtime's native macOS/Linux telemetry before it initializes.
 * Call on the main thread: worker-local process.env changes cannot update the
 * native getenv() value read by ONNX Runtime. This suppresses its uploader,
 * events, and persistent device identifier; it does not control Windows ETW.
 * https://github.com/microsoft/onnxruntime/blob/v1.30.0/docs/Privacy.md
 */
export function disableOnnxTelemetry(): void {
  process.env.ORT_DISABLE_TELEMETRY = '1';
}
