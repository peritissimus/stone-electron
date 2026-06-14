import type { IRequestSystemAudioAccessUseCase } from '../../../domain/ports/in/ISystemUseCases';
import type { ISystemBridge, SystemAudioPermission } from '../../../domain';

/**
 * There's no clean programmatic prompt for Screen Recording (it fires on the
 * first capture, or via System Settings), so "request" returns the current
 * status and the UI offers an "Open Settings" deep link.
 */
export class RequestSystemAudioAccessUseCase implements IRequestSystemAudioAccessUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(): Promise<{ status: SystemAudioPermission }> {
    return { status: this.systemBridge.getScreenCaptureAccessStatus() };
  }
}
