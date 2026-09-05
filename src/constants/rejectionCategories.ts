/**
 * SRS 5.3.1.2 — On-Site Issue Escalation and Material-Delay Rejection are two
 * distinct paths, not one generic reject. 'OTHER' covers every other reject
 * reason (e.g. customer unavailable, duplicate job) that isn't either of those.
 * Shared between HomeScreen and TaskDetailScreen so both job-rejection entry
 * points use the same categorization, not a screen-specific vocabulary.
 */
export type RejectionCategory = 'ISSUE_MISMATCH' | 'MATERIAL_DELAY' | 'OTHER';
export type ObservedIssueType = 'INTERNET' | 'PHONE' | 'FIBER' | 'TV' | 'OTHER';

export const REJECTION_CATEGORIES: {
  value: RejectionCategory;
  icon: string;
  label: string;
}[] = [
  {value: 'ISSUE_MISMATCH', icon: '🔀', label: 'Issue Mismatch'},
  {value: 'MATERIAL_DELAY', icon: '📦', label: 'Material Delay'},
  {value: 'OTHER', icon: '❓', label: 'Other'},
];

// Mirrors the backend's Fault.FaultCategory enum (fieldops) — the closed
// vocabulary an Admin/Team Lead already assigns a fault from, reused here so
// "observed issue type" is directly comparable to what was assigned.
export const OBSERVED_ISSUE_TYPES: {
  value: ObservedIssueType;
  icon: string;
  label: string;
}[] = [
  {value: 'INTERNET', icon: '🌐', label: 'Internet'},
  {value: 'PHONE', icon: '📞', label: 'Phone'},
  {value: 'FIBER', icon: '🔌', label: 'Fiber'},
  {value: 'TV', icon: '📺', label: 'TV'},
  {value: 'OTHER', icon: '🔧', label: 'Other'},
];
