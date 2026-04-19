import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';
import type { IValidateSystemPathUseCase } from '../../../domain/ports/in/ISystemUseCases';

export class ValidateSystemPathUseCase implements IValidateSystemPathUseCase {
  constructor(private readonly systemBridge: ISystemBridge) {}

  async execute(request: { path: string }): Promise<{ isValid: boolean }> {
    const isValid = await this.systemBridge.validatePath(request.path);
    return { isValid };
  }
}
