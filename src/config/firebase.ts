import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

import { env } from './env';

const app = initializeApp(env.firebase);

export const auth = getAuth(app);

if (env.useFirebaseEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099');
