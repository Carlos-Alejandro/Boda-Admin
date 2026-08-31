import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

import { env } from './env';

const app = initializeApp(env.firebase);

export const auth = getAuth(app);
