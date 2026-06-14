import type { IGetMicAccessStatusUseCase } from '../../../domain/ports/in/ISystemUseCases';
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
