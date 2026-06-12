import type {
  IGetMicAccessStatusUseCase,
  IRequestMicAccessUseCase,
} from '../../../domain/ports/in/ISystemUseCases';
import type { ISystemBridge, MicrophoneAccessStatus } from '../../../domain';

/**
 * Read the OS microphone permission state without prompting. Used by
 * onboarding's permission step and (later) any recorder preflight.
 */
export class GetMicAccessStatusUseCase implements IGetMicAccessStatusUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(): Promise<{ status: MicrophoneAccessStatus }> {
    return { status: this.systemBridge.getMicrophoneAccessStatus() };
  }
}

/**
 * Trigger the OS microphone prompt (macOS shows the TCC dialog once;
 * after a denial only System Settings can flip it back — callers should
 * route the user there when granted comes back false on a 'denied' status).
 */
export class RequestMicAccessUseCase implements IRequestMicAccessUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(): Promise<{ granted: boolean; status: MicrophoneAccessStatus }> {
    const granted = await this.systemBridge.askForMicrophoneAccess();
    return { granted, status: this.systemBridge.getMicrophoneAccessStatus() };
  }
}
