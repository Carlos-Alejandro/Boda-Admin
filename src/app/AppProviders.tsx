import type { ReactNode } from 'react';

import { AuthProvider } from '../auth/AuthProvider';
import { AdminToaster } from '../shared/notifications/AdminToaster';

interface AppProvidersProps {
	children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
	return (
		<AuthProvider>
			{children}
			<AdminToaster />
		</AuthProvider>
	);
}
