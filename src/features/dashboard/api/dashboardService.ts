import { apiRequest } from '../../../services/http/apiClient';

export interface AdminHealthResponse {
	status: 'ok';
	service: 'boda-api';
	authenticated: true;
}

function parseAdminHealthResponse(value: unknown): AdminHealthResponse {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('Respuesta API inválida: salud administrativa.');
	}
	if (!('status' in value) || !('service' in value) || !('authenticated' in value) ||
		value.status !== 'ok' || value.service !== 'boda-api' || value.authenticated !== true) {
		throw new Error('Respuesta API inválida: salud administrativa.');
	}
	return { status: 'ok', service: 'boda-api', authenticated: true };
}

export function getAdminHealth() {
	return apiRequest('/api/admin/health', {}, [200], parseAdminHealthResponse);
}
