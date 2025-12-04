import { drizzle } from 'drizzle-orm/neon-http';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

const db = drizzle(DATABASE_URL);