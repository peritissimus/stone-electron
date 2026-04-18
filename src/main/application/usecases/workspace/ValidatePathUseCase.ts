import {
  type IValidatePathUseCase,
  type ValidatePathRequest,
  type ValidatePathResponse,
} from '../../../domain';
import type { ISystemBridge } from '../../../domain/ports/out/ISystemBridge';

export class ValidatePathUseCase implements IValidatePathUseCase {
  constructor(private readonly systemService: ISystemBridge) {}

  async execute(request: ValidatePathRequest): Promise<ValidatePathResponse> {
    const isValid = await this.systemService.validatePath(request.folderPath);
    if (!isValid) {
      return { valid: false, error: 'Path does not exist or is not accessible' };
    }
    return { valid: true };
  }
}
