import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type {
  IGlobalShortcutRegistrar,
  QuickCaptureShortcutStatus,
} from '../../../domain/ports/out/IGlobalShortcutRegistrar';

function publishQuickCaptureChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'quickCapture' },
  });
}

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

export class SetQuickCaptureShortcutUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly registrar: IGlobalShortcutRegistrar,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  /**
   * Persist the requested accelerator and (re)bind it. The accelerator is
   * persisted even if the OS rejects it, so the user's choice survives a
   * restart — the returned `registered: false` lets the UI prompt for another.
   * An empty string intentionally clears the global hotkey.
   */
  async execute(request: { shortcut: string }): Promise<QuickCaptureShortcutStatus> {
    const shortcut = request.shortcut.trim();
    await this.appConfigRepository.update((config) => ({
      ...config,
      quickCapture: { ...config.quickCapture, shortcut },
    }));
    const status = this.registrar.bindQuickCapture(shortcut);
    publishQuickCaptureChanged(this.eventPublisher);
    return status;
  }
}
