import type {
  IGetSystemAudioAccessUseCase,
  IRequestSystemAudioAccessUseCase,
} from '../../../domain/ports/in/ISystemUseCases';
import type { ISystemAudioTap, SystemAudioPermission } from '../../../domain';

/**
 * System-audio (Screen & System Audio Recording) permission state for the
 * onboarding permissions step. Backed by the native tap helper; when no tap
 * is wired (non-macOS), both report 'unsupported' and the UI hides the row.
 */
export class GetSystemAudioAccessUseCase implements IGetSystemAudioAccessUseCase {
  constructor(private readonly systemAudioTap?: ISystemAudioTap) {}

  async execute(): Promise<{ status: SystemAudioPermission }> {
    if (!this.systemAudioTap?.isSupported()) return { status: 'unsupported' };
    return { status: await this.systemAudioTap.checkPermission() };
  }
}

export class RequestSystemAudioAccessUseCase implements IRequestSystemAudioAccessUseCase {
  constructor(private readonly systemAudioTap?: ISystemAudioTap) {}

  async execute(): Promise<{ status: SystemAudioPermission }> {
    if (!this.systemAudioTap?.isSupported()) return { status: 'unsupported' };
    return { status: await this.systemAudioTap.requestPermission() };
  }
}
