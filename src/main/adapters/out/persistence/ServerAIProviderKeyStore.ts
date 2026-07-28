import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AI_PROVIDER_DEFINITIONS,
  type AIProviderId,
  type AIProviderKeyStatus,
  type IAIProviderKeyStore,
} from '../../../domain';

interface EncryptedValue {
  iv: string;
  tag: string;
  value: string;
}

interface KeyFile {
  version: 1;
  providers: Partial<Record<AIProviderId, EncryptedValue>>;
}

/**
 * AES-GCM credential store for the headless server.
 *
 * The encryption key is generated once beside the credential file with 0600
 * permissions, unless STONE_SECRET_KEY is provided by the deployment.
 */
export class ServerAIProviderKeyStore implements IAIProviderKeyStore {
  constructor(
    private readonly keyFilePath: string,
    private readonly secretFilePath: string,
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  async listStatuses(): Promise<AIProviderKeyStatus[]> {
    const stored = await this.read();
    return AI_PROVIDER_DEFINITIONS.map((definition) => {
      const hasEnvKey = Boolean(this.env[definition.envVar]?.trim());
      const hasStoredKey = Boolean(stored.providers[definition.id]);
      return {
        provider: definition.id,
        label: definition.label,
        envVar: definition.envVar,
        hasEnvKey,
        hasStoredKey,
        available: hasEnvKey || hasStoredKey,
        activeSource: hasStoredKey ? 'stored' : hasEnvKey ? 'env' : null,
      };
    });
  }

  async getKey(provider: AIProviderId): Promise<string | null> {
    const stored = (await this.read()).providers[provider];
    if (stored) return this.decrypt(stored);
    const definition = AI_PROVIDER_DEFINITIONS.find((candidate) => candidate.id === provider);
    return definition ? this.env[definition.envVar]?.trim() || null : null;
  }

  async setKey(provider: AIProviderId, apiKey: string): Promise<void> {
    const file = await this.read();
    file.providers[provider] = await this.encrypt(apiKey);
    await this.write(file);
  }

  async deleteKey(provider: AIProviderId): Promise<void> {
    const file = await this.read();
    delete file.providers[provider];
    await this.write(file);
  }

  private async encryptionKey(): Promise<Buffer> {
    const configured = this.env.STONE_SECRET_KEY?.trim();
    if (configured) {
      return crypto.createHash('sha256').update(configured).digest();
    }
    try {
      const encoded = await fs.readFile(this.secretFilePath, 'utf8');
      return Buffer.from(encoded.trim(), 'base64');
    } catch {
      const key = crypto.randomBytes(32);
      await fs.mkdir(path.dirname(this.secretFilePath), { recursive: true });
      await fs.writeFile(this.secretFilePath, `${key.toString('base64')}\n`, {
        mode: 0o600,
      });
      await fs.chmod(this.secretFilePath, 0o600);
      return key;
    }
  }

  private async encrypt(value: string): Promise<EncryptedValue> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', await this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      value: encrypted.toString('base64'),
    };
  }

  private async decrypt(value: EncryptedValue): Promise<string> {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      await this.encryptionKey(),
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(value.value, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private async read(): Promise<KeyFile> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.keyFilePath, 'utf8')) as KeyFile;
      return parsed.version === 1 && parsed.providers ? parsed : { version: 1, providers: {} };
    } catch {
      return { version: 1, providers: {} };
    }
  }

  private async write(value: KeyFile): Promise<void> {
    await fs.mkdir(path.dirname(this.keyFilePath), { recursive: true });
    await fs.writeFile(this.keyFilePath, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
    });
    await fs.chmod(this.keyFilePath, 0o600);
  }
}
