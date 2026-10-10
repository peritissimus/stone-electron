/**
 * Vitest Setup File
 *
 * This file runs before all tests.
 */

import { disableOnnxTelemetry } from '../src/main/infrastructure/telemetry/onnxTelemetry';

// Vitest's fork pool runs this on each test process's main thread, before any
// direct native ONNX consumers (including AEC integrations) initialize.
disableOnnxTelemetry();
