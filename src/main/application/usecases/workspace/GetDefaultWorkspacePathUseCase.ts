import {
  type IGetDefaultWorkspacePathUseCase,
  type GetDefaultWorkspacePathResponse,
} from '../../../domain';
import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';

/**
 * Resolves the suggested location for a new notebook workspace, used by
 * first-launch onboarding to prefill the folder field. Honors an absolute
 * path the user may have set in config; otherwise the system bridge falls
 * back to an OS default (~/Documents/Stone).
 */
export class GetDefaultWorkspacePathUseCase implements IGetDefaultWorkspacePathUseCase {
  constructor(
    private readonly systemBridge: ISystemBridge,
    private readonly appConfigRepository: IAppConfigRepository,
  ) {}

  async execute(): Promise<GetDefaultWorkspacePathResponse> {
    const config = await this.appConfigRepository.get();
    const resolved = this.systemBridge.getDefaultWorkspaceDir(config.workspace.defaultWorkspacePath);
    return { path: resolved };
  }
}
