import { test, expect } from '@playwright/test';

test.describe('AI Settings - Local Model Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    // Wait for app to load
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  });

  test('should browse and load local model', async ({ page }) => {
    // Open settings modal
    await page.click('[data-testid="settings-button"]');
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
    
    // Navigate to AI tab
    await page.click('[data-testid="ai-settings-tab"]');
    await expect(page.locator('[data-testid="ai-settings-content"]')).toBeVisible();
    
    // Select Local LLM provider
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    await expect(page.locator('[data-testid="local-model-path-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-model-button"]')).toBeVisible();
    
    // Mock file selection (intercept the file dialog)
    const mockFilePath = 'C:\\models\\test-model.gguf';
    
    // Create a mock file for the dialog
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="browse-model-button"]');
    const fileChooser = await fileChooserPromise;
    
    // Simulate selecting a file
    await fileChooser.setFiles({
      name: 'test-model.gguf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('mock GGUF file content')
    });
    
    // Verify the path is set
    await expect(page.locator('[data-testid="local-model-path-input"]')).toHaveValue(/test-model\.gguf/);
    
    // Save settings
    await page.click('[data-testid="save-ai-settings-button"]');
    
    // Wait for success status
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved!', { timeout: 5000 });
    
    // Verify local model status shows as loaded
    await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
    await expect(page.locator('[data-testid="unload-model-button"]')).toBeVisible();
  });

  test('should maintain model state across tab switches', async ({ page }) => {
    // First load a model (repeat steps from first test)
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="browse-model-button"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'persistent-model.gguf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('mock persistent model')
    });
    
    await page.click('[data-testid="save-ai-settings-button"]');
    await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
    
    // Close settings
    await page.click('[data-testid="close-settings-button"]');
    await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible();
    
    // Reopen settings
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
  });

  test('should unload model successfully', async ({ page }) => {
    // Load a model first
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="browse-model-button"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'unload-test-model.gguf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('mock unload test model')
    });
    
    await page.click('[data-testid="save-ai-settings-button"]');
    await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
    
    // Click unload button
    await page.click('[data-testid="unload-model-button"]');
    
    // Verify model is unloaded
    await expect(page.locator('[data-testid="local-model-status"]')).toContainText('No model loaded');
    await expect(page.locator('[data-testid="unload-model-button"]')).not.toBeVisible();
  });

  test('should initialize model on chat if not loaded', async ({ page }) => {
    // Set up local model in settings but don't save
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="browse-model-button"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'chat-test-model.gguf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('mock chat test model')
    });
    
    await page.click('[data-testid="save-ai-settings-button"]');
    await page.click('[data-testid="close-settings-button"]');
    
    // Navigate to chat
    await page.click('[data-testid="chat-button"]');
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
    
    // Send a chat message
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.click('[data-testid="send-chat-button"]');
    
    // Model should be automatically loaded and response generated
    await expect(page.locator('[data-testid="chat-response"]')).toBeVisible({ timeout: 10000 });
  });

  test('should persist local model configuration across app restart', async ({ page, context }) => {
    // Configure and load a model
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="browse-model-button"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'persistent-test.gguf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('mock persistent test model')
    });
    
    await page.click('[data-testid="save-ai-settings-button"]');
    await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
    await page.click('[data-testid="close-settings-button"]');
    
    // Simulate app restart by refreshing the page
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
    
    // Check if settings are preserved
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    
    // Verify provider is still Local LLM
    await expect(page.locator('[data-testid="ai-provider-select"]')).toHaveValue('local-llama');
    
    // Verify model field contains the file name
    await expect(page.locator('[data-testid="local-model-path-input"]')).toHaveValue(/persistent-test\.gguf/);
  });
});

test.describe('AI Settings - Error Handling', () => {
  test('should handle invalid model files gracefully', async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    
    // Try to select an invalid file type
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="browse-model-button"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'invalid-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Invalid model file')
    });
    
    // Should show error or not allow the selection
    await page.click('[data-testid="save-ai-settings-button"]');
    
    // Check for error message or failure to load
    const status = page.locator('[data-testid="local-model-status"]');
    await expect(status).toContainText(/No model loaded|Error/, { timeout: 5000 });
  });

  test('should handle missing model file', async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="ai-settings-tab"]');
    await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
    
    // Type a path manually without browsing
    await page.fill('[data-testid="local-model-path-input"]', 'C:\\nonexistent\\model.gguf');
    await page.click('[data-testid="save-ai-settings-button"]');
    
    // Should show error that model couldn't be loaded
    await expect(page.locator('[data-testid="local-model-status"]')).toContainText(/No model loaded|failed/, { timeout: 5000 });
  });
});