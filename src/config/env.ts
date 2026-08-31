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

export const env = {
	firebase: {
		apiKey: readRequiredEnvironmentVariable('VITE_FIREBASE_API_KEY'),
		authDomain: readRequiredEnvironmentVariable('VITE_FIREBASE_AUTH_DOMAIN'),
		projectId: readRequiredEnvironmentVariable('VITE_FIREBASE_PROJECT_ID'),
		storageBucket: readRequiredEnvironmentVariable(
			'VITE_FIREBASE_STORAGE_BUCKET',
		),
		messagingSenderId: readRequiredEnvironmentVariable(
			'VITE_FIREBASE_MESSAGING_SENDER_ID',
		),
		appId: readRequiredEnvironmentVariable('VITE_FIREBASE_APP_ID'),
	},
} as const;
