import { test as setup, expect } from '@playwright/test';
import { assertApiHealthy } from '../helpers/api';

setup('API health check @p0', async () => {
  await assertApiHealthy();
  expect(true).toBeTruthy();
});
