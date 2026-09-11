/**
 * Real API tests intentionally avoid the global unit-test mocks.
 *
 * These tests must exercise the production filesystem, subprocess, and network
 * implementations so a passing result represents an actual Blade trajectory.
 */
import { TextDecoder, TextEncoder } from 'node:util';
import { afterAll } from 'vitest';
import { configureOwnedTestStorageRoot } from './ownedTestStorageRoot.js';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'false';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
configureOwnedTestStorageRoot('blade-real-api', (cleanup) => {
  afterAll(cleanup);
});

if (process.env.REAL_API_TEST === '1') {
  const { getEnabledModelConfigs, buildRealApiRuntimeConfig } = await import(
    '../integration/real-api/testConfig.js'
  );
  const [runtimeModel] = getEnabledModelConfigs();
  if (runtimeModel) {
    const [{ ensureStoreInitialized, getState }, { getPiModelCatalog }] =
      await Promise.all([
        import('../../src/store/vanilla.js'),
        import('../../src/services/pi/PiModelCatalog.js'),
      ]);
    await ensureStoreInitialized();
    await getPiModelCatalog().setApiKey(runtimeModel.provider, runtimeModel.apiKey);
    getState().config.actions.setConfig(buildRealApiRuntimeConfig(runtimeModel));
  }
}
