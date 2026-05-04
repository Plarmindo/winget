# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright.ai-settings.test.ts >> AI Settings - Local Model Management >> should browse and load local model
- Location: tests\playwright.ai-settings.test.ts:10:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:1420/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('AI Settings - Local Model Management', () => {
  4   |   test.beforeEach(async ({ page }) => {
> 5   |     await page.goto('http://localhost:1420');
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  6   |     // Wait for app to load
  7   |     await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  8   |   });
  9   | 
  10  |   test('should browse and load local model', async ({ page }) => {
  11  |     // Open settings modal
  12  |     await page.click('[data-testid="settings-button"]');
  13  |     await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
  14  |     
  15  |     // Navigate to AI tab
  16  |     await page.click('[data-testid="ai-settings-tab"]');
  17  |     await expect(page.locator('[data-testid="ai-settings-content"]')).toBeVisible();
  18  |     
  19  |     // Select Local LLM provider
  20  |     await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
  21  |     await expect(page.locator('[data-testid="local-model-path-input"]')).toBeVisible();
  22  |     await expect(page.locator('[data-testid="browse-model-button"]')).toBeVisible();
  23  |     
  24  |     // Mock file selection (intercept the file dialog)
  25  |     const mockFilePath = 'C:\\models\\test-model.gguf';
  26  |     
  27  |     // Create a mock file for the dialog
  28  |     const fileChooserPromise = page.waitForEvent('filechooser');
  29  |     await page.click('[data-testid="browse-model-button"]');
  30  |     const fileChooser = await fileChooserPromise;
  31  |     
  32  |     // Simulate selecting a file
  33  |     await fileChooser.setFiles({
  34  |       name: 'test-model.gguf',
  35  |       mimeType: 'application/octet-stream',
  36  |       buffer: Buffer.from('mock GGUF file content')
  37  |     });
  38  |     
  39  |     // Verify the path is set
  40  |     await expect(page.locator('[data-testid="local-model-path-input"]')).toHaveValue(/test-model\.gguf/);
  41  |     
  42  |     // Save settings
  43  |     await page.click('[data-testid="save-ai-settings-button"]');
  44  |     
  45  |     // Wait for success status
  46  |     await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved!', { timeout: 5000 });
  47  |     
  48  |     // Verify local model status shows as loaded
  49  |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
  50  |     await expect(page.locator('[data-testid="unload-model-button"]')).toBeVisible();
  51  |   });
  52  | 
  53  |   test('should maintain model state across tab switches', async ({ page }) => {
  54  |     // First load a model (repeat steps from first test)
  55  |     await page.click('[data-testid="settings-button"]');
  56  |     await page.click('[data-testid="ai-settings-tab"]');
  57  |     await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
  58  |     
  59  |     const fileChooserPromise = page.waitForEvent('filechooser');
  60  |     await page.click('[data-testid="browse-model-button"]');
  61  |     const fileChooser = await fileChooserPromise;
  62  |     await fileChooser.setFiles({
  63  |       name: 'persistent-model.gguf',
  64  |       mimeType: 'application/octet-stream',
  65  |       buffer: Buffer.from('mock persistent model')
  66  |     });
  67  |     
  68  |     await page.click('[data-testid="save-ai-settings-button"]');
  69  |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
  70  |     
  71  |     // Close settings
  72  |     await page.click('[data-testid="close-settings-button"]');
  73  |     await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible();
  74  |     
  75  |     // Reopen settings
  76  |     await page.click('[data-testid="settings-button"]');
  77  |     await page.click('[data-testid="ai-settings-tab"]');
  78  |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
  79  |   });
  80  | 
  81  |   test('should unload model successfully', async ({ page }) => {
  82  |     // Load a model first
  83  |     await page.click('[data-testid="settings-button"]');
  84  |     await page.click('[data-testid="ai-settings-tab"]');
  85  |     await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
  86  |     
  87  |     const fileChooserPromise = page.waitForEvent('filechooser');
  88  |     await page.click('[data-testid="browse-model-button"]');
  89  |     const fileChooser = await fileChooserPromise;
  90  |     await fileChooser.setFiles({
  91  |       name: 'unload-test-model.gguf',
  92  |       mimeType: 'application/octet-stream',
  93  |       buffer: Buffer.from('mock unload test model')
  94  |     });
  95  |     
  96  |     await page.click('[data-testid="save-ai-settings-button"]');
  97  |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
  98  |     
  99  |     // Click unload button
  100 |     await page.click('[data-testid="unload-model-button"]');
  101 |     
  102 |     // Verify model is unloaded
  103 |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText('No model loaded');
  104 |     await expect(page.locator('[data-testid="unload-model-button"]')).not.toBeVisible();
  105 |   });
```