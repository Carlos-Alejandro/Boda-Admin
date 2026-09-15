import type { Invitation, RsvpStatus } from '../../invitations/model/invitation.types';

export interface DashboardMetrics {
 registeredInvitations: number;
 activeInvitations: number;
 archivedInvitations: number;
 currentSlots: number;
 identifiedPeople: number;
 attending: number;
 notAttending: number;
 unanswered: number;
 unassignedSpaces: number;
 currentReplacements: number;
 rsvp: Record<RsvpStatus, number>;
}

export function calculateDashboardMetrics(invitations: Invitation[]): DashboardMetrics {
 const allInvitations = invitations;
 const activeInvitations = allInvitations.filter((item) => item.isArchived === false);
 const archivedInvitations = allInvitations.filter((item) => item.isArchived === true);
 const metrics: DashboardMetrics = {
  registeredInvitations: allInvitations.length,
  activeInvitations: activeInvitations.length,
  archivedInvitations: archivedInvitations.length,
  currentSlots: 0, identifiedPeople: 0, attending: 0, notAttending: 0,
  unanswered: 0, unassignedSpaces: 0, currentReplacements: 0,
  rsvp: { pending: 0, partial: 0, confirmed: 0, declined: 0 },
 };
 for (const invitation of activeInvitations) {
  metrics.currentSlots += invitation.maxGuests;
  metrics.rsvp[invitation.rsvpStatus] += 1;
  for (const guest of invitation.guests) {
   const hasName = guest.name.trim() !== '';
   if (hasName) metrics.identifiedPeople += 1;
   if (guest.attending === true) metrics.attending += 1;
   if (guest.attending === false) metrics.notAttending += 1;
   if (hasName && guest.attending === null) metrics.unanswered += 1;
   if (guest.type === 'open' && !hasName && guest.attending !== true) metrics.unassignedSpaces += 1;
   if (guest.type === 'replacement') metrics.currentReplacements += 1;
  }
 }
 return metrics;
}
