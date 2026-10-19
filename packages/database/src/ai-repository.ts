import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';

export type AiProviderType = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'OPENAI_COMPATIBLE';

export interface AiCapabilities {
  readonly chat: boolean;
  readonly streaming: boolean;
  readonly toolCalling: boolean;
  readonly nativeWebSearch: boolean;
}

export interface AiProviderConfigRecord {
  readonly id: string;
  readonly providerType: AiProviderType;
  readonly displayName: string;
  readonly baseUrl: string | null;
  readonly modelId: string;
  readonly credentialRef: string;
  readonly capabilities: AiCapabilities;
  readonly isDefault: boolean;
  readonly lastVerifiedAt: string | null;
  readonly lastError: string | null;
  readonly version: number;
}

interface AiProviderRow {
  id: string;
  provider_type: AiProviderType;
  display_name: string;
  base_url: string | null;
  model_id: string;
  credential_ref: string;
  capabilities_json: string;
  is_default: 0 | 1;
  last_verified_at: number | null;
  last_error: string | null;
  version: number;
}

const unsupportedCapabilities: AiCapabilities = {
  chat: false,
  streaming: false,
  toolCalling: false,
  nativeWebSearch: false,
};

export class AiRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public listProviders(): readonly AiProviderConfigRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT p.*, e.version FROM ai_provider_configs p
         JOIN entity_index e ON e.id = p.id WHERE e.deleted_at IS NULL
         ORDER BY p.is_default DESC, p.display_name COLLATE NOCASE`,
      )
      .all() as AiProviderRow[];
    return rows.map((row) => this.map(row));
  }

  public getProvider(id: string): AiProviderConfigRecord | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT p.*, e.version FROM ai_provider_configs p
         JOIN entity_index e ON e.id = p.id WHERE p.id=? AND e.deleted_at IS NULL`,
      )
      .get(id) as AiProviderRow | undefined;
    return row === undefined ? undefined : this.map(row);
  }

  public createProvider(input: {
    providerType: AiProviderType;
    displayName: string;
    baseUrl?: string | null;
    modelId: string;
  }): AiProviderConfigRecord {
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id,entity_type,created_at,updated_at)
           VALUES (?,'AI_PROVIDER_CONFIG',?,?)`,
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO ai_provider_configs(
             id,provider_type,display_name,base_url,model_id,credential_ref,capabilities_json,is_default
           ) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.providerType,
          input.displayName,
          input.baseUrl ?? null,
          input.modelId,
          `life-assistant:ai-provider:${id}`,
          JSON.stringify(unsupportedCapabilities),
          this.listProviders().length === 0 ? 1 : 0,
        );
    });
    const provider = this.getProvider(id);
    if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    return provider;
  }

  public updateProvider(
    id: string,
    expectedVersion: number,
    input: { displayName?: string; baseUrl?: string | null; modelId?: string },
  ): AiProviderConfigRecord {
    const current = this.getProvider(id);
    if (current === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(`UPDATE ai_provider_configs SET display_name=?,base_url=?,model_id=? WHERE id=?`)
        .run(
          input.displayName ?? current.displayName,
          input.baseUrl === undefined ? current.baseUrl : input.baseUrl,
          input.modelId ?? current.modelId,
          id,
        );
      this.database.raw
        .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
        .run(now, id);
    });
    const provider = this.getProvider(id);
    if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    return provider;
  }

  public recordVerification(
    id: string,
    capabilities: AiCapabilities,
    error: string | null,
  ): AiProviderConfigRecord {
    const current = this.getProvider(id);
    if (current === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `UPDATE ai_provider_configs
           SET capabilities_json=?,last_verified_at=?,last_error=? WHERE id=?`,
        )
        .run(JSON.stringify(capabilities), now, error, id);
      this.database.raw
        .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
        .run(now, id);
    });
    const provider = this.getProvider(id);
    if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    return provider;
  }

  public setDefault(id: string, expectedVersion: number): AiProviderConfigRecord {
    const current = this.getProvider(id);
    if (current === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    if (current.isDefault) return current;
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `UPDATE ai_provider_configs
           SET is_default=CASE WHEN id=? THEN 1 ELSE 0 END
           WHERE id IN (SELECT id FROM entity_index WHERE entity_type='AI_PROVIDER_CONFIG' AND deleted_at IS NULL)`,
        )
        .run(id);
      this.database.raw
        .prepare(
          `UPDATE entity_index SET version=version+1,updated_at=?
           WHERE entity_type='AI_PROVIDER_CONFIG' AND deleted_at IS NULL`,
        )
        .run(now);
    });
    const provider = this.getProvider(id);
    if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    return provider;
  }

  public deleteProvider(id: string, expectedVersion: number): void {
    const current = this.getProvider(id);
    if (current === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare('UPDATE entity_index SET deleted_at=?,updated_at=?,version=version+1 WHERE id=?')
        .run(now, now, id);
      if (current.isDefault) {
        this.database.raw.prepare('UPDATE ai_provider_configs SET is_default=0 WHERE id=?').run(id);
        const replacement = this.database.raw
          .prepare(
            `SELECT p.id FROM ai_provider_configs p
             JOIN entity_index e ON e.id=p.id
             WHERE e.deleted_at IS NULL
             ORDER BY p.display_name COLLATE NOCASE LIMIT 1`,
          )
          .get() as { id: string } | undefined;
        if (replacement !== undefined) {
          this.database.raw
            .prepare('UPDATE ai_provider_configs SET is_default=1 WHERE id=?')
            .run(replacement.id);
          this.database.raw
            .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
            .run(now, replacement.id);
        }
      }
    });
  }

  private map(row: AiProviderRow): AiProviderConfigRecord {
    return {
      id: row.id,
      providerType: row.provider_type,
      displayName: row.display_name,
      baseUrl: row.base_url,
      modelId: row.model_id,
      credentialRef: row.credential_ref,
      capabilities: JSON.parse(row.capabilities_json) as AiCapabilities,
      isDefault: row.is_default === 1,
      lastVerifiedAt:
        row.last_verified_at === null ? null : new Date(row.last_verified_at).toISOString(),
      lastError: row.last_error,
      version: row.version,
    };
  }
}
