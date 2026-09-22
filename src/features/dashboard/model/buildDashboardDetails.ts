import type { Invitation } from '../../invitations/model/invitation.types';

// Presentation limits only: totals always include every active invitation.
export const DASHBOARD_SELECTION_SIZE = 5;
const compareNames = (a: Invitation, b: Invitation) =>
 a.displayName.localeCompare(b.displayName, 'es-MX') || a.id.localeCompare(b.id);

export function buildDashboardDetails(invitations: Invitation[]) {
 const active = invitations.filter(invitation => !invitation.isArchived);
 const alphabetical = [...active].sort(compareNames);
 const unanswered = alphabetical.flatMap(invitation => invitation.guests.flatMap((guest, index) =>
  guest.name.trim() && guest.attending === null
   ? [{ invitationId: invitation.id, invitationName: invitation.displayName, name: guest.name, index }]
   : []));
 const dated = active.filter(invitation => invitation.updatedAt !== null && Number.isFinite(Date.parse(invitation.updatedAt)));
 return {
  capacity: [...active].sort((a, b) => b.maxGuests - a.maxGuests || compareNames(a, b)).slice(0, DASHBOARD_SELECTION_SIZE),
  unanswered: unanswered.slice(0, DASHBOARD_SELECTION_SIZE),
  recent: dated.sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!) || compareNames(a, b)).slice(0, DASHBOARD_SELECTION_SIZE),
  datedInvitations: dated.length,
 };
}

export type DashboardDetails = ReturnType<typeof buildDashboardDetails>;
