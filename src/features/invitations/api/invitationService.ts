import { apiRequest } from '../../../services/http/apiClient';
import type { InvitationListResponse } from '../model/invitation.types';

export function getInvitations() {
	return apiRequest<InvitationListResponse>('/api/admin/invitations');
}
