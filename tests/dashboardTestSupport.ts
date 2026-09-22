import type { Guest, Invitation } from '../src/features/invitations/model/invitation.types';

export const guest = (name: string, attending: boolean | null = null, type: Guest['type'] = 'known'): Guest => ({
 name, attending, type, shortName: name || 'Acompañante', ...(type === 'replacement' ? { originalName: 'Persona original' } : {}),
});
export const invitation = (id: string, overrides: Partial<Invitation> = {}): Invitation => ({
 id, version: 'v1', displayName: `Familia ${id}`, maxGuests: 1, replacementsAllowed: true,
 rsvpStatus: 'pending', message: '', isArchived: false, archivedAt: null, updatedAt: null,
 editOverrideUntil: null, guests: [guest(`Persona ${id}`)], ...overrides,
});
