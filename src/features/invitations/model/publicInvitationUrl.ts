export function getPublicInvitationUrl(invitationId: string): string {
	const configuredBaseUrl = import.meta.env.VITE_PUBLIC_INVITATION_BASE_URL;

	if (typeof configuredBaseUrl !== 'string' || configuredBaseUrl.trim() === '') {
		throw new Error('Falta la variable VITE_PUBLIC_INVITATION_BASE_URL.');
	}

	const baseUrl = configuredBaseUrl.trim().replace(/\/+$/, '');
	return `${baseUrl}/invitacion/${encodeURIComponent(invitationId)}`;
}
