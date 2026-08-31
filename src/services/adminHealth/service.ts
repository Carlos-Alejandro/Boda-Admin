import { apiRequest } from '../http/apiClient';

export interface AdminHealthResponse {
	status: string;
	service: string;
	authenticated: boolean;
}

export function getAdminHealth() {
	return apiRequest<AdminHealthResponse>('/api/admin/health');
}