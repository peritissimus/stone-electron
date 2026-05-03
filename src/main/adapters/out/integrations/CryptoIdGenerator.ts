import crypto from 'node:crypto';
import type { IIdGenerator } from '../../../domain';

export class CryptoIdGenerator implements IIdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
