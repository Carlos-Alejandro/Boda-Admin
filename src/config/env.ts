const emulatorFlag = import.meta.env.VITE_USE_FIREBASE_EMULATORS ?? 'false';

if (emulatorFlag !== 'true' && emulatorFlag !== 'false') {
	throw new Error('VITE_USE_FIREBASE_EMULATORS debe ser true o false.');
}

const useFirebaseEmulators = emulatorFlag === 'true';

if (useFirebaseEmulators && !import.meta.env.DEV) {
	throw new Error('Firebase Emulator Suite solo se puede habilitar en desarrollo.');
}

function requireLoopbackUrl(value: string | undefined, name: string, port: string) {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new Error(`Falta la variable de entorno requerida: ${name}`);
	}

	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error(`${name} debe apuntar a un servicio local.`);
	}

	if (
		parsed.protocol !== 'http:' ||
		!['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
		parsed.port !== port ||
		parsed.username !== '' ||
		parsed.password !== '' ||
		parsed.pathname !== '/' ||
		parsed.search !== '' ||
		parsed.hash !== ''
	) {
		throw new Error(`${name} debe apuntar a loopback en el puerto ${port}.`);
	}
}

const requiredFirebaseEnvironmentVariables = [
	'VITE_FIREBASE_API_KEY',
	'VITE_FIREBASE_AUTH_DOMAIN',
	'VITE_FIREBASE_PROJECT_ID',
	'VITE_FIREBASE_STORAGE_BUCKET',
	'VITE_FIREBASE_MESSAGING_SENDER_ID',
	'VITE_FIREBASE_APP_ID',
] as const;

type FirebaseEnvironmentVariable =
	(typeof requiredFirebaseEnvironmentVariables)[number];

function readRequiredEnvironmentVariable(name: FirebaseEnvironmentVariable) {
	const value = import.meta.env[name];

	if (typeof value !== 'string' || value.trim() === '') {
		throw new Error(`Falta la variable de entorno requerida: ${name}`);
	}

	return value;
}

if (useFirebaseEmulators) {
	requireLoopbackUrl(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL', '3000');
	requireLoopbackUrl(import.meta.env.VITE_PUBLIC_INVITATION_BASE_URL, 'VITE_PUBLIC_INVITATION_BASE_URL', '5173');
}

export const env = {
	useFirebaseEmulators,
	firebase: useFirebaseEmulators
		? {
			apiKey: 'demo-api-key',
			authDomain: 'demo-boda.firebaseapp.com',
			projectId: 'demo-boda',
			storageBucket: 'demo-boda.appspot.com',
			messagingSenderId: '0',
			appId: '1:0:web:demo',
		}
		: {
			apiKey: readRequiredEnvironmentVariable('VITE_FIREBASE_API_KEY'),
			authDomain: readRequiredEnvironmentVariable('VITE_FIREBASE_AUTH_DOMAIN'),
			projectId: readRequiredEnvironmentVariable('VITE_FIREBASE_PROJECT_ID'),
			storageBucket: readRequiredEnvironmentVariable('VITE_FIREBASE_STORAGE_BUCKET'),
			messagingSenderId: readRequiredEnvironmentVariable('VITE_FIREBASE_MESSAGING_SENDER_ID'),
			appId: readRequiredEnvironmentVariable('VITE_FIREBASE_APP_ID'),
		},
} as const;