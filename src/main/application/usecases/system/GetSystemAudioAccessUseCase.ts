import type { IGetSystemAudioAccessUseCase } from '../../../domain/ports/in/ISystemUseCases';
import type { ISystemBridge, SystemAudioPermission } from '../../../domain';

/**
 * System-audio (Screen & System Audio Recording) permission state for the
 * onboarding permissions step and Settings → Recording. System audio is now
 * captured in-process via getDisplayMedia loopback, so the relevant grant is
 * the app's macOS Screen Recording permission — read straight from the OS.
 */
export class GetSystemAudioAccessUseCase implements IGetSystemAudioAccessUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(): Promise<{ status: SystemAudioPermission }> {
    return { status: this.systemBridge.getScreenCaptureAccessStatus() };
  }
}
