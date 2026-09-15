import { apiRequest } from '../../../services/http/apiClient';
import type {
	ChangeInvitationCapacityInput,
	CreateInvitationInput,
	Invitation,
	InvitationFilters,
	InvitationListResponse,
	UpdateInvitationInput,
} from '../model/invitation.types';

export function getInvitations(filters: InvitationFilters = {}) {
	const query = new URLSearchParams();
	const search = filters.search?.trim();

	if (search) query.set('search', search);
	if (filters.rsvpStatus) query.set('rsvpStatus', filters.rsvpStatus);
	if (filters.archived !== undefined) {
		query.set('archived', String(filters.archived));
	}

	const queryString = query.toString();
	const path = `/api/admin/invitations${queryString ? `?${queryString}` : ''}`;

	return apiRequest<InvitationListResponse>(path);
}

export function getInvitationById(id: string, signal?: AbortSignal) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(id)}`, {
		signal,
	});
}

export function createInvitation(input: CreateInvitationInput) {
	return apiRequest<Invitation>('/api/admin/invitations', {
		method: 'POST',
		body: JSON.stringify(input),
	});
}

export function updateInvitation(id: string, input: UpdateInvitationInput) {
	const payload: UpdateInvitationInput = {};
	if (input.displayName !== undefined) payload.displayName = input.displayName;
	if (input.replacementsAllowed !== undefined) payload.replacementsAllowed = input.replacementsAllowed;
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		body: JSON.stringify(payload),
	});
}

export function changeInvitationCapacity(id: string, input: ChangeInvitationCapacityInput, signal?: AbortSignal) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(id)}/capacity`, {
		method: 'PATCH',
		body: JSON.stringify({ maxGuests: input.maxGuests }),
		signal,
	});
}

export function removeInvitationGuest(invitationId: string, guestIndex: number, version: string, signal?: AbortSignal) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(invitationId)}/guests/${guestIndex}/remove`, {
		method: 'POST',
		headers: { 'X-Invitation-Version': version },
		signal,
	});
}

export function restoreInvitationReplacement(invitationId: string, guestIndex: number, invitationVersion: string) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(invitationId)}/guests/${guestIndex}/restore-replacement`, {
		method: 'POST',
		headers: { 'X-Invitation-Version': invitationVersion },
	});
}

export function updateInvitationGuestName(invitationId: string, guestIndex: number, invitationVersion: string, name: string) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(invitationId)}/guests/${guestIndex}`, {
		method: 'PATCH',
		headers: { 'X-Invitation-Version': invitationVersion },
		body: JSON.stringify({ name }),
	});
}

export function archiveInvitation(id: string) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(id)}/archive`, {
		method: 'POST',
	});
}

export function updateInvitationEditOverride(invitationId: string, editOverrideUntil: string | null, invitationVersion: string) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(invitationId)}`, {
		method: 'PATCH',
		headers: { 'X-Invitation-Version': invitationVersion },
		body: JSON.stringify({ editOverrideUntil }),
	});
}

export function restoreInvitation(id: string) {
	return apiRequest<Invitation>(`/api/admin/invitations/${encodeURIComponent(id)}/restore`, {
		method: 'POST',
	});
}
