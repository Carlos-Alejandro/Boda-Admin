import type { ImportAnalysis, ImportIssue, InvitationPreview } from './import.types';

export function buildImportPreview(invitations: InvitationPreview[], issues: ImportIssue[]): ImportAnalysis {
  const valid = invitations.filter((invitation) => invitation.valid);
  // Aggregate with BigInt, preserving exact counts without imposing a global capacity limit.
  const people = valid.reduce((total, invitation) => total + BigInt(invitation.knownGuests.length), 0n);
  const spaces = valid.reduce((total, invitation) => total + BigInt(invitation.openSlots!), 0n);
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return {
    valid: errors === 0 && invitations.length > 0,
    invitations, issues,
    summary: {
      invitations: invitations.length,
      identifiedPeople: people.toString(), openSlots: spaces.toString(), totalSlots: (people + spaces).toString(),
      validInvitations: valid.length, invalidInvitations: invitations.length - valid.length,
      errors, warnings: issues.length - errors,
    },
  };
}
