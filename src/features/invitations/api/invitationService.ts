import { apiRequest } from '../../../services/http/apiClient';
import type {
	InvitationFilters,
	InvitationListResponse,
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
