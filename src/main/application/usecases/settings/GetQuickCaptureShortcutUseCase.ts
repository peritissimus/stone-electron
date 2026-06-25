import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type {
  IGlobalShortcutRegistrar,
  QuickCaptureShortcutStatus,
} from '../../../domain/ports/out/IGlobalShortcutRegistrar';

export class GetQuickCaptureShortcutUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly registrar: IGlobalShortcutRegistrar,
  ) {}

  /**
   * Reports the live binding. The registrar is the source of truth for what is
   * actually registered with the OS; if it has never bound (e.g. before the
   * startup bind ran) we fall back to the configured accelerator with
   * `registered: false`.
   */
  async execute(): Promise<QuickCaptureShortcutStatus> {
    const status = this.registrar.getQuickCaptureStatus();
    if (status.shortcut) return status;

    const config = await this.appConfigRepository.get();
    return { shortcut: config.quickCapture.shortcut, registered: false };
  }
}
