export const CANONICAL_SNAPSHOT_CONTRACT_VERSION = 1 as const;

export interface CanonicalEntitySnapshot<TCanonicalState = unknown, TOwnedRelations = unknown> {
  readonly contractVersion: typeof CANONICAL_SNAPSHOT_CONTRACT_VERSION;
  readonly entityType: string;
  readonly canonicalState: TCanonicalState;
  readonly ownedRelations: TOwnedRelations;
}

export interface CanonicalSnapshotMetadata {
  readonly contractVersion: typeof CANONICAL_SNAPSHOT_CONTRACT_VERSION;
  readonly snapshotKind: 'CANONICAL' | 'BASELINE';
  readonly restoreEligibility: 'ELIGIBLE';
}

export const canonicalSnapshotMetadata = (
  snapshotKind: CanonicalSnapshotMetadata['snapshotKind'],
): CanonicalSnapshotMetadata => ({
  contractVersion: CANONICAL_SNAPSHOT_CONTRACT_VERSION,
  snapshotKind,
  restoreEligibility: 'ELIGIBLE',
});

export const isTrustedCanonicalSnapshotMetadata = (
  value: unknown,
): value is CanonicalSnapshotMetadata => {
  if (typeof value !== 'object' || value === null) return false;
  const metadata = value as Record<string, unknown>;
  return (
    metadata.contractVersion === CANONICAL_SNAPSHOT_CONTRACT_VERSION &&
    (metadata.snapshotKind === 'CANONICAL' || metadata.snapshotKind === 'BASELINE') &&
    metadata.restoreEligibility === 'ELIGIBLE'
  );
};
