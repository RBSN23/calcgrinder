/**
 * Format the deletion date (pending_deletion_at timestamp + retention_days)
 * as a human-readable date string. Uses en-US to keep the email + UI in sync
 * (the app is English-only per PRD).
 */
export function formatDeletionDate(
  pendingDeletionAt: string,
  retentionDays: number,
): string {
  const start = new Date(pendingDeletionAt);
  const deletionAt = new Date(start.getTime() + retentionDays * 86_400_000);
  return deletionAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
