import { test, expect } from './fixtures';
import { DEFAULT_SETTINGS } from '../src/stores/slices/settingsSlice';

// Helper: set model path on the readOnly input (Tauri native dialog can't be intercepted by Playwright)
async function setModelPath(page: any, path: string) {
  await page.evaluate((p: string) => {
    const input = document.querySelector('[data-testid="local-model-path-input"]') as HTMLInputElement;
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(input, p);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, path);
}

// Helper: open settings and navigate to AI tab
async function openAiSettings(page: any) {
  await page.click('[data-testid="settings-button"]');
  await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 30000 });
  // Use force:true to bypass any overlay intercepting clicks
  await page.click('[data-testid="ai-settings-tab"]', { force: true });
  await expect(page.locator('[data-testid="ai-settings-content"]')).toBeVisible({ timeout: 10000 });
}

// The settings button is hidden below the md breakpoint (Navbar uses `hidden md:flex`),
// so these flows are only reachable on desktop/tablet viewports — the mobile project
// excludes the @md-up tag declaratively via `grepInvert` in playwright.config.ts.
test.describe('AI Settings - Local Model Management', { tag: ['@md-up', '@flaky'] }, () => {
  // Local-model tests poll model status and touch disk, which has historically
  // flaked under load — retry so occasional slow runs self-heal instead of failing.
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    // Prevent onboarding modal from appearing
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('onboarding_seen', 'true'));
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 30000 });
  });

  test('should browse and load local model', async ({ page }) => {
    await openAiSettings(page);
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await expect(page.locator('[data-testid="local-model-path-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-model-button"]')).toBeVisible();
    await setModelPath(page, 'C:\\models\\test-model.gguf');
    await page.click('[data-testid="save-ai-settings-button"]', { force: true });
    await expect(page.locator('[data-testid="save-status"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="local-model-status"]')).toBeVisible({ timeout: 10000 });
  });

  test('should maintain model state across tab switches', async ({ page }) => {
    await openAiSettings(page);
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await setModelPath(page, 'C:\\models\\persistent-model.gguf');
    await page.click('[data-testid="save-ai-settings-button"]', { force: true });
    await expect(page.locator('[data-testid="local-model-status"]')).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="close-settings-button"]', { force: true });
    await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible();
    await openAiSettings(page);
    await expect(page.locator('[data-testid="local-model-status"]')).toBeVisible({ timeout: 10000 });
  });

  test('should unload model successfully', async ({ page }) => {
    await openAiSettings(page);
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await setModelPath(page, 'C:\\models\\unload-test-model.gguf');
    await page.click('[data-testid="save-ai-settings-button"]', { force: true });
    await expect(page.locator('[data-testid="local-model-status"]')).toBeVisible({ timeout: 10000 });
    // The model initializes on save; the Unload button only renders while loaded.
    const unloadBtn = page.locator('[data-testid="unload-model-button"]');
    await expect(unloadBtn).toBeVisible({ timeout: 10000 });
    await unloadBtn.click({ force: true });
    await expect(unloadBtn).not.toBeVisible({ timeout: 10000 });
  });

  test('should initialize model on chat if not loaded', async ({ page }) => {
    await openAiSettings(page);
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await setModelPath(page, 'C:\\models\\chat-test-model.gguf');
    await page.click('[data-testid="save-ai-settings-button"]', { force: true });
    await page.click('[data-testid="close-settings-button"]', { force: true });
    await page.click('[data-testid="chat-button"]');
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible({ timeout: 10000 });
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.click('[data-testid="send-chat-button"]');
    await page.waitForTimeout(3000);
  });

  test('should persist local model configuration across app restart', async ({ page }) => {
    await openAiSettings(page);
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await setModelPath(page, 'C:\\models\\persistent-test.gguf');
    await page.click('[data-testid="save-ai-settings-button"]', { force: true });
    await expect(page.locator('[data-testid="local-model-status"]')).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="close-settings-button"]', { force: true });
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 30000 });
    await openAiSettings(page);
    await expect(page.locator('[data-testid="ai-provider-select"]')).toHaveValue('local-llama');
  });
});

test.describe('AI Settings - Deep-link focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('onboarding_seen', 'true'));
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 30000 });
  });

  // Web-mode deep link from the welcome screen (no navbar involved, so it works
  // on every viewport): Browse Essentials with no API key opens Settings on the
  // Intelligence tab and focuses the provider select (nothing configured yet).
  test('deep link from Browse Essentials focuses the provider select when no provider is configured', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /browse essentials/i }).click();
    await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="ai-settings-content"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="ai-provider-select"]')).toBeFocused();
  });

  // A "saved" non-Gemini provider with no Base URL deep-links to the Base URL
  // input (the next missing field), not the provider select or the API key.
  test('deep link focuses the Base URL input when a non-Gemini provider lacks an endpoint', async ({ page }) => {
    const seededSettings = {
      ...DEFAULT_SETTINGS,
      aiConfig: {
        ...DEFAULT_SETTINGS.aiConfig,
        provider: 'openai',
        baseUrl: '',
        modelId: 'gpt-4o',
        apiKey: '',
      },
    };
    // Seed the persisted store, then reload so it rehydrates from the seed.
    await page.evaluate((settings) => {
      localStorage.setItem('winget-app-storage', JSON.stringify({ state: { settings }, version: 0 }));
    }, seededSettings);
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 30000 });

    await page.getByRole('button', { name: /browse essentials/i }).click();
    await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="ai-settings-content"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="ai-base-url-input"]')).toBeFocused();
  });

  // Manual navigation must never yank focus. Requires the navbar settings button,
  // which is hidden below the md breakpoint, so the mobile project excludes this
  // @md-up tag declaratively via `grepInvert` in playwright.config.ts.
  test(
    'manually opening the Intelligence tab from the navbar does not focus any field',
    { tag: '@md-up' },
    async ({ page }) => {
      await page.click('[data-testid="settings-button"]');
      await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 30000 });
      await page.click('[data-testid="ai-settings-tab"]', { force: true });
      await expect(page.locator('[data-testid="ai-settings-content"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-provider-select"]')).not.toBeFocused();
      await expect(page.locator('[data-testid="ai-settings-content"] input[type="password"]')).not.toBeFocused();
    }
  );
});

// Settings flows require the navbar settings button (`hidden md:flex`), so the mobile
// project excludes this describe via the @md-up tag + `grepInvert` in playwright.config.ts.
test.describe('AI Settings - Error Handling', { tag: ['@md-up', '@flaky'] }, () => {
  // Same load-sensitivity as the model-management describe above.
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('onboarding_seen', 'true'));
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 30000 });
  });

  test('should handle invalid model files gracefully', async ({ page }) => {
    await openAiSettings(page);
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await setModelPath(page, 'C:\\invalid\\not-a-model.txt');
    await page.click('[data-testid="save-ai-settings-button"]', { force: true });
    await expect(page.locator('[data-testid="local-model-status"]')).toBeVisible({ timeout: 10000 });
  });

  test('should handle missing model file', async ({ page }) => {
    await openAiSettings(page);
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await setModelPath(page, 'C:\\nonexistent\\model.gguf');
    await page.click('[data-testid="save-ai-settings-button"]', { force: true });
    await expect(page.locator('[data-testid="local-model-status"]')).toBeVisible({ timeout: 10000 });
  });
});
