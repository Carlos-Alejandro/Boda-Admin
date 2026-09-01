export type GuestType = 'known' | 'open' | 'replacement';

export interface Guest {
	name: string;
	shortName: string;
	type: GuestType;
	attending: boolean | null;
	originalName?: string;
}

export type RsvpStatus =
	| 'pending'
	| 'confirmed'
	| 'partial'
	| 'declined';

export interface Invitation {
	id: string;
	displayName: string;
	maxGuests: number;
	replacementsAllowed: boolean;
	rsvpStatus: RsvpStatus;
	message: string;
	isArchived: boolean;
	archivedAt: string | null;
	updatedAt: string | null;
	editOverrideUntil: string | null;
	guests: Guest[];
}

export interface InvitationListResponse {
	items: Invitation[];
	total: number;
}
