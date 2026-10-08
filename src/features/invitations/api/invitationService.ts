import { apiRequest } from '../../../services/http/apiClient';
import type {
	ChangeInvitationCapacityInput,
	CreateInvitationInput,
	InvitationFilters,
	UpdateInvitationInput,
} from '../model/invitation.types';
import { parseInvitationListResponse, parseInvitationResponse } from './invitationResponse';

export function getInvitations(filters: InvitationFilters = {}) {
	const query = new URLSearchParams();
	const search = filters.search?.trim();

	if (search) query.set('search', search);
	if (filters.rsvpStatus) query.set('rsvpStatus', filters.rsvpStatus);
	if (filters.archived !== undefined) {
		query.set('archived', String(filters.archived));
	}
	if (filters.page !== undefined) query.set('page', String(filters.page));
	if (filters.pageSize !== undefined) query.set('pageSize', String(filters.pageSize));

	const queryString = query.toString();
	const path = `/api/admin/invitations${queryString ? `?${queryString}` : ''}`;

	return apiRequest(path, {}, [200], parseInvitationListResponse);
}

export function getInvitationById(id: string, signal?: AbortSignal) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(id)}`, {
		signal,
	}, [200], parseInvitationResponse);
}

export function createInvitation(input: CreateInvitationInput, options: { idempotencyKey?: string; signal?: AbortSignal } = {}) {
	return apiRequest('/api/admin/invitations', {
		method: 'POST',
		body: JSON.stringify(input),
		...(options.idempotencyKey ? { headers: { 'Idempotency-Key': options.idempotencyKey } } : {}),
		signal: options.signal,
	}, options.idempotencyKey ? [200, 201] : [201], parseInvitationResponse);
}

export function updateInvitation(id: string, input: UpdateInvitationInput) {
	const payload: UpdateInvitationInput = {};
	if (input.displayName !== undefined) payload.displayName = input.displayName;
	if (input.replacementsAllowed !== undefined) payload.replacementsAllowed = input.replacementsAllowed;
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		body: JSON.stringify(payload),
	}, [200], parseInvitationResponse);
}

export function changeInvitationCapacity(id: string, input: ChangeInvitationCapacityInput, signal?: AbortSignal) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(id)}/capacity`, {
		method: 'PATCH',
		body: JSON.stringify({ maxGuests: input.maxGuests }),
		signal,
	}, [200], parseInvitationResponse);
}

export function removeInvitationGuest(invitationId: string, guestIndex: number, version: string, signal?: AbortSignal) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(invitationId)}/guests/${guestIndex}/remove`, {
		method: 'POST',
		headers: { 'X-Invitation-Version': version },
		signal,
	}, [200], parseInvitationResponse);
}

export function restoreInvitationReplacement(invitationId: string, guestIndex: number, invitationVersion: string) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(invitationId)}/guests/${guestIndex}/restore-replacement`, {
		method: 'POST',
		headers: { 'X-Invitation-Version': invitationVersion },
	}, [200], parseInvitationResponse);
}

export function updateInvitationGuestName(invitationId: string, guestIndex: number, invitationVersion: string, name: string) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(invitationId)}/guests/${guestIndex}`, {
		method: 'PATCH',
		headers: { 'X-Invitation-Version': invitationVersion },
		body: JSON.stringify({ name }),
	}, [200], parseInvitationResponse);
}

export function archiveInvitation(id: string) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(id)}/archive`, {
		method: 'POST',
	}, [200], parseInvitationResponse);
}

export function updateInvitationEditOverride(invitationId: string, editOverrideUntil: string | null, invitationVersion: string) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(invitationId)}`, {
		method: 'PATCH',
		headers: { 'X-Invitation-Version': invitationVersion },
		body: JSON.stringify({ editOverrideUntil }),
	}, [200], parseInvitationResponse);
}

export function restoreInvitation(id: string) {
	return apiRequest(`/api/admin/invitations/${encodeURIComponent(id)}/restore`, {
		method: 'POST',
	}, [200], parseInvitationResponse);
}
