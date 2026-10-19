import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';

/**
 * 日志脱敏器：识别常见 API Key 前缀、Bearer Token、Authorization / x-api-key / api_key
 * 与 credential_ref 字段，将值替换为 [REDACTED]。所有日志写入和诊断包导出前都必须经过它。
 */
export const redactSensitiveText = (text: string): string =>
  text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi, '$1[REDACTED]')
    .replace(/(sk-[A-Za-z0-9_-]{6,})/g, 'sk-[REDACTED]')
    .replace(
      /((?:authorization|x-api-key|api[_-]?key|credential[_-]?ref)\s*[:=]\s*)(?!Bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi,
      '$1[REDACTED]',
    );

export interface LogFileInfo {
  readonly name: string;
  readonly bytes: number;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogManagerOptions {
  /** 单个日志文件的最大字节数，超过则轮换。默认 5 MB。 */
  readonly maxBytes?: number;
  /** 保留的轮换文件数量（不含当前文件）。默认 5。 */
  readonly maxFiles?: number;
  /** 类别日志的默认级别过滤。默认 info。 */
  readonly level?: LogLevel;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * 本地日志管理器：向数据目录 logs/ 写入 JSON 行日志（pino/Fastify 兼容流），
 * 支持按大小轮换、类别日志与统一脱敏。写入采用同步追加，避免长期占用文件句柄，
 * 从而在 Windows 上可以安全地重命名轮换文件。
 */
export class LogManager {
  public readonly maxBytes: number;
  public readonly maxFiles: number;
  public readonly level: LogLevel;
  private readonly directory: string;
  private readonly primaryName = 'app.log';
  private bytesWritten = 0;

  public constructor(directory: string, options: LogManagerOptions = {}) {
    this.directory = directory;
    this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
    this.maxFiles = options.maxFiles ?? 5;
    this.level = options.level ?? 'info';
    mkdirSync(directory, { recursive: true });
    const primaryPath = join(directory, this.primaryName);
    if (existsSync(primaryPath)) {
      try {
        this.bytesWritten = statSync(primaryPath).size;
      } catch {
        this.bytesWritten = 0;
      }
    }
  }

  /** pino / Fastify 可用的写入流；每一行在落盘前经过脱敏。 */
  public createStream(): Writable {
    return new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        try {
          this.appendLine(redactSensitiveText(chunk.toString('utf8')));
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
    });
  }

  /** 写入一条带类别的结构化日志。 */
  public write(category: string, level: LogLevel, message: string, fields: object = {}): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.level]) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      category,
      msg: redactSensitiveText(message),
      ...fields,
    });
    this.appendLine(redactSensitiveText(line));
  }

  /** 返回日志目录中的文件与大小（当前文件优先）。 */
  public listFiles(): LogFileInfo[] {
    const names = [this.primaryName];
    for (let i = 1; i <= this.maxFiles; i += 1) names.push(`${this.primaryName}.${String(i)}`);
    const output: LogFileInfo[] = [];
    for (const name of names) {
      const path = join(this.directory, name);
      if (!existsSync(path)) continue;
      try {
        output.push({ name, bytes: statSync(path).size });
      } catch {
        // 文件可能在轮换过程中被移动。
      }
    }
    return output;
  }

  /** 读取指定日志文件的脱敏内容（最多 maxBytes 字节，从尾部截取）。 */
  public readLogFile(name: string, maxBytes = 512 * 1024): string {
    const path = join(this.directory, name);
    if (!existsSync(path)) return '';
    try {
      const file = readFileSync(path, 'utf8');
      return redactSensitiveText(file.slice(Math.max(0, file.length - maxBytes)));
    } catch {
      // 文件可能在轮换过程中被移动。
      return '';
    }
  }

  /** 读取最近日志（脱敏后的原始内容），供诊断信息使用。 */
  public tail(maxBytes = 256 * 1024): string {
    const entries = this.listFiles().slice(0, this.maxFiles);
    let remaining = maxBytes;
    const chunks: string[] = [];
    for (const entry of entries) {
      if (remaining <= 0) break;
      const path = join(this.directory, entry.name);
      const take = Math.min(remaining, entry.bytes);
      try {
        const file = readFileSync(path, 'utf8');
        const content = file.slice(Math.max(0, file.length - take));
        chunks.push(content);
        remaining -= take;
      } catch {
        // 文件可能在轮换过程中被移动。
      }
    }
    return redactSensitiveText(chunks.join('\n'));
  }

  public close(): void {
    // 同步追加写入不持有长期句柄，无需关闭。
  }

  private appendLine(line: string): void {
    const payload = line.endsWith('\n') ? line : `${line}\n`;
    const bytes = Buffer.byteLength(payload, 'utf8');
    if (bytes > this.maxBytes) {
      // 单行超过上限时仍然写入，但先做一次轮换，避免无限膨胀。
      this.rotate();
    } else if (this.bytesWritten + bytes > this.maxBytes) {
      this.rotate();
    }
    writeFileSync(this.primaryPath(), payload, { flag: 'a' });
    this.bytesWritten += bytes;
  }

  private primaryPath(): string {
    return join(this.directory, this.primaryName);
  }

  private rotate(): void {
    // 删除最旧文件，然后整体后移，保留恰好 maxFiles 个轮换文件。
    const oldest = join(this.directory, `${this.primaryName}.${String(this.maxFiles)}`);
    if (existsSync(oldest)) rmSync(oldest);
    for (let i = this.maxFiles; i >= 1; i -= 1) {
      const from =
        i === 1 ? this.primaryPath() : join(this.directory, `${this.primaryName}.${String(i - 1)}`);
      const to = join(this.directory, `${this.primaryName}.${String(i)}`);
      if (existsSync(from)) renameSync(from, to);
    }
    this.bytesWritten = 0;
  }
}
