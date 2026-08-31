import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from '../routes/AppRoutes';
import { AppProviders } from './AppProviders';

export function App() {
	return (
		<AppProviders>
			<BrowserRouter>
				<AppRoutes />
			</BrowserRouter>
		</AppProviders>
	);
}
