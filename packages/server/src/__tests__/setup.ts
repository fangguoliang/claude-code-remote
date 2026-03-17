// Set environment variables BEFORE any modules are imported
process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key-for-testing';

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { initDatabase, clearDatabase } from '../db/index.js';

beforeAll(async () => {
  await initDatabase();
});

beforeEach(async () => {
  // Clear all tables between tests for isolation
  clearDatabase();
});

afterAll(async () => {
  // Cleanup
});