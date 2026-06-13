// stone-audio-tap — minimal system-audio capture helper for Stone.
//
// Captures macOS system audio (what's playing through the speakers /
// headphones — i.e. remote meeting voices) via ScreenCaptureKit's audio
// stream and writes raw 16 kHz mono s16le PCM to a file. The Electron main
// process spawns this per recording, sends SIGTERM to stop, and mixes the
// PCM with the microphone WAV before transcription.
//
// Commands:
//   stone-audio-tap check            → {"supported":bool,"permission":"granted"|"denied"}
//   stone-audio-tap request          → triggers the Screen Recording TCC prompt; prints same JSON
//   stone-audio-tap record <path>    → capture until SIGTERM/SIGINT; exit 0 on clean stop
//
// Permission: gated by macOS "Screen & System Audio Recording" (TCC),
// attributed to the responsible app (Stone when packaged, Electron in dev).
//
// Build: scripts/build-native.sh → native/bin/stone-audio-tap

import AVFoundation
import CoreGraphics
import CoreMedia
import Foundation
import ScreenCaptureKit

let SAMPLE_RATE = 16_000

func printJSON(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    }
}

// Write a single line to stdout unbuffered. Used for the readiness signal and
// the high-frequency level stream during `record`, where stdio buffering would
// otherwise delay or coalesce lines before the parent process reads them.
func emitLine(_ str: String) {
    FileHandle.standardOutput.write(Data((str + "\n").utf8))
}

func permissionGranted() -> Bool {
    return CGPreflightScreenCaptureAccess()
}

// MARK: - Stream output

final class AudioWriter: NSObject, SCStreamOutput, SCStreamDelegate {
    private let handle: FileHandle
    private var sampleCount: Int = 0
    // Throttle the live level stream to ~15 Hz — enough for a smooth waveform,
    // cheap enough not to flood the IPC bridge.
    private var lastLevelEmit = CFAbsoluteTimeGetCurrent()
    private let levelInterval = 0.066

    init(handle: FileHandle) {
        self.handle = handle
    }

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .audio, sampleBuffer.isValid else { return }

        // SCK delivers float32 PCM at the configured rate/channels. Convert
        // to s16le and append. channelCount=1 in the config keeps this to a
        // single buffer — no interleaving concerns.
        var framePeak: Float32 = 0
        do {
            try sampleBuffer.withAudioBufferList { audioBufferList, _ in
                for buffer in audioBufferList {
                    guard let raw = buffer.mData else { continue }
                    let frameCount = Int(buffer.mDataByteSize) / MemoryLayout<Float32>.size
                    let floats = raw.bindMemory(to: Float32.self, capacity: frameCount)
                    var out = [Int16](repeating: 0, count: frameCount)
                    for i in 0..<frameCount {
                        let clamped = max(-1.0, min(1.0, floats[i]))
                        out[i] = Int16(clamped * Float32(Int16.max))
                        let mag = abs(clamped)
                        if mag > framePeak { framePeak = mag }
                    }
                    out.withUnsafeBufferPointer { ptr in
                        handle.write(Data(buffer: ptr))
                    }
                    sampleCount += frameCount
                }
            }
        } catch {
            // Drop the buffer; transient CMSampleBuffer issues shouldn't kill
            // the recording.
        }

        // Emit the peak level for the live waveform, throttled.
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastLevelEmit >= levelInterval {
            lastLevelEmit = now
            emitLine("{\"level\":\(String(format: "%.3f", framePeak))}")
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        FileHandle.standardError.write(Data("stream stopped: \(error)\n".utf8))
        exit(3)
    }
}

// MARK: - Commands

func runCheck(request: Bool) {
    var granted = permissionGranted()
    if !granted && request {
        granted = CGRequestScreenCaptureAccess()
        // CGRequest returns the pre-prompt state on first ask; re-poll once
        // the user has responded is the caller's job (re-run `check`).
        granted = granted || permissionGranted()
    }
    printJSON(["supported": true, "permission": granted ? "granted" : "denied"])
}

func runRecord(path: String) async {
    guard permissionGranted() || CGRequestScreenCaptureAccess() else {
        FileHandle.standardError.write(Data("screen capture permission denied\n".utf8))
        exit(2)
    }

    FileManager.default.createFile(atPath: path, contents: nil)
    guard let handle = FileHandle(forWritingAtPath: path) else {
        FileHandle.standardError.write(Data("cannot open output file\n".utf8))
        exit(1)
    }

    do {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false, onScreenWindowsOnly: false)
        guard let display = content.displays.first else {
            FileHandle.standardError.write(Data("no display\n".utf8))
            exit(1)
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = true
        config.sampleRate = SAMPLE_RATE
        config.channelCount = 1
        // Video is mandatory in the SCK pipeline but we never attach a video
        // output — keep it as cheap as possible.
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

        let writer = AudioWriter(handle: handle)
        let stream = SCStream(filter: filter, configuration: config, delegate: writer)
        try stream.addStreamOutput(
            writer, type: .audio, sampleHandlerQueue: DispatchQueue(label: "audio-tap"))
        try await stream.startCapture()

        // Signal readiness so the spawner can correlate start time. Use the
        // unbuffered writer so it interleaves correctly with the level stream.
        emitLine("{\"recording\":true}")

        // Block until SIGTERM/SIGINT, then stop cleanly so buffers flush.
        let semaphore = DispatchSemaphore(value: 0)
        let handleSignal: @convention(c) (Int32) -> Void = { _ in
            tapStopSemaphore?.signal()
        }
        tapStopSemaphore = semaphore
        signal(SIGTERM, handleSignal)
        signal(SIGINT, handleSignal)
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            DispatchQueue.global().async {
                semaphore.wait()
                cont.resume()
            }
        }

        try await stream.stopCapture()
        try handle.close()
        exit(0)
    } catch {
        FileHandle.standardError.write(Data("capture failed: \(error)\n".utf8))
        exit(1)
    }
}

// signal handlers can't capture context — use a global.
var tapStopSemaphore: DispatchSemaphore?

// MARK: - Entry

let args = CommandLine.arguments
let command = args.count > 1 ? args[1] : "check"

switch command {
case "check":
    runCheck(request: false)
case "request":
    runCheck(request: true)
case "record":
    guard args.count > 2 else {
        FileHandle.standardError.write(Data("usage: stone-audio-tap record <path>\n".utf8))
        exit(64)
    }
    let path = args[2]
    Task {
        await runRecord(path: path)
    }
    RunLoop.main.run()
default:
    FileHandle.standardError.write(Data("unknown command: \(command)\n".utf8))
    exit(64)
}
