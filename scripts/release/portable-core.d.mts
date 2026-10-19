export interface ManifestFileEntry {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
}

export interface ReleaseManifest {
  readonly formatVersion: 1;
  readonly releaseVersion: string;
  readonly appVersion: string;
  readonly gitCommit: string;
  readonly schemaVersion: number;
  readonly openApiSha256: string;
  readonly builtAt: string;
  readonly fileCount: number;
  readonly files: readonly ManifestFileEntry[];
}

export declare const computeSchemaVersion: (migrationsSource: string) => number;
export declare const sha256Buffer: (content: Uint8Array) => string;
export declare const collectRelativeFiles: (
  root: string,
  excludeNames?: readonly string[],
) => Promise<readonly string[]>;
export declare const buildManifest: (
  releaseRoot: string,
  meta: Omit<ReleaseManifest, 'formatVersion' | 'fileCount' | 'files'>,
) => Promise<ReleaseManifest>;
export declare const findForbiddenContent: (
  text: string,
  forbiddenPaths: readonly string[],
) => readonly string[];
export declare const isExcludedReleaseFile: (name: string) => boolean;
