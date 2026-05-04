# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright.ai-settings.test.ts >> AI Settings - Error Handling >> should handle missing model file
- Location: tests\playwright.ai-settings.test.ts:197:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="settings-button"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7] [cursor=pointer]:
        - img [ref=e9]
        - generic [ref=e13]:
          - generic [ref=e14]: Winget Web
          - generic [ref=e16]:
            - img [ref=e17]
            - text: "Web Mode: Read Only"
      - generic [ref=e22]:
        - combobox "Search winget packages..." [ref=e23]
        - img
      - generic [ref=e24]:
        - generic [ref=e25]:
          - combobox [ref=e26] [cursor=pointer]:
            - option "Winget (Win)" [selected]
            - option "Chocolatey (Win)"
            - option "Scoop (Win)"
            - option "Homebrew (Mac/Lin)"
            - option "APT (Linux)"
            - option "GitHub (Any)"
          - generic:
            - img
        - generic [ref=e27]:
          - button [ref=e28] [cursor=pointer]:
            - img [ref=e29]
          - generic: Refresh Packages
        - generic [ref=e34]:
          - button [ref=e35] [cursor=pointer]:
            - img [ref=e36]
          - generic: Help & Walkthrough (F1)
        - button "Settings" [ref=e39] [cursor=pointer]:
          - img [ref=e40]
        - button "CTRL K" [ref=e43] [cursor=pointer]:
          - generic [ref=e44]: CTRL
          - generic [ref=e45]: K
        - generic [ref=e46]:
          - button [ref=e47] [cursor=pointer]:
            - img [ref=e48]
          - generic: View Cart (0 items)
  - tablist "Application mode" [ref=e51]:
    - generic [ref=e52]:
      - tab "Switch to install mode" [selected] [ref=e53] [cursor=pointer]:
        - img [ref=e54]
        - generic [ref=e57]: install
      - tab "Switch to upgrade mode" [ref=e58] [cursor=pointer]:
        - img [ref=e59]
        - generic [ref=e64]: upgrade
      - tab "Switch to uninstall mode" [ref=e65] [cursor=pointer]:
        - img [ref=e66]
        - generic [ref=e69]: uninstall
      - tab "Switch to github mode" [ref=e70] [cursor=pointer]:
        - img [ref=e71]
        - generic [ref=e74]: github
  - main [ref=e75]:
    - generic [ref=e76]:
      - generic [ref=e77]:
        - heading "WinGet Web Interface" [level=1] [ref=e78]
        - paragraph [ref=e79]: The modern way to explore, install, and manage system applications.
      - generic [ref=e80]:
        - button "Browse Essentials Discover popular tools for developers and power users." [ref=e81] [cursor=pointer]:
          - img [ref=e83]
          - heading "Browse Essentials" [level=3] [ref=e85]
          - paragraph [ref=e86]: Discover popular tools for developers and power users.
        - button "Check Upgrades Identify installed apps and generate an upgrade script." [ref=e87] [cursor=pointer]:
          - img [ref=e89]
          - heading "Check Upgrades" [level=3] [ref=e94]
          - paragraph [ref=e95]: Identify installed apps and generate an upgrade script.
        - button "Uninstall Apps Clean up bloatware and remove unused applications." [ref=e96] [cursor=pointer]:
          - img [ref=e98]
          - heading "Uninstall Apps" [level=3] [ref=e101]
          - paragraph [ref=e102]: Clean up bloatware and remove unused applications.
      - generic [ref=e104]:
        - button "Browsers" [ref=e105] [cursor=pointer]
        - button "Communication" [ref=e106] [cursor=pointer]
        - button "Dev Tools" [ref=e107] [cursor=pointer]
        - button "Add" [ref=e108] [cursor=pointer]:
          - img [ref=e109]
          - text: Add
        - button [ref=e110] [cursor=pointer]:
          - img [ref=e111]
  - generic [ref=e113]:
    - generic [ref=e114]:
      - generic [ref=e115]:
        - img [ref=e117]
        - generic [ref=e119]:
          - heading "Generate Script" [level=2] [ref=e120]
          - paragraph [ref=e121]: "Target: winget"
      - button [ref=e122] [cursor=pointer]:
        - img [ref=e123]
    - generic [ref=e127]:
      - img [ref=e128]
      - paragraph [ref=e130]: Cart is empty.
  - button [ref=e131] [cursor=pointer]:
    - img [ref=e132]
```

# Test source

```ts
  99  |     // Click unload button
  100 |     await page.click('[data-testid="unload-model-button"]');
  101 |     
  102 |     // Verify model is unloaded
  103 |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText('No model loaded');
  104 |     await expect(page.locator('[data-testid="unload-model-button"]')).not.toBeVisible();
  105 |   });
  106 | 
  107 |   test('should initialize model on chat if not loaded', async ({ page }) => {
  108 |     // Set up local model in settings but don't save
  109 |     await page.click('[data-testid="settings-button"]');
  110 |     await page.click('[data-testid="ai-settings-tab"]');
  111 |     await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
  112 |     
  113 |     const fileChooserPromise = page.waitForEvent('filechooser');
  114 |     await page.click('[data-testid="browse-model-button"]');
  115 |     const fileChooser = await fileChooserPromise;
  116 |     await fileChooser.setFiles({
  117 |       name: 'chat-test-model.gguf',
  118 |       mimeType: 'application/octet-stream',
  119 |       buffer: Buffer.from('mock chat test model')
  120 |     });
  121 |     
  122 |     await page.click('[data-testid="save-ai-settings-button"]');
  123 |     await page.click('[data-testid="close-settings-button"]');
  124 |     
  125 |     // Navigate to chat
  126 |     await page.click('[data-testid="chat-button"]');
  127 |     await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
  128 |     
  129 |     // Send a chat message
  130 |     await page.fill('[data-testid="chat-input"]', 'Test message');
  131 |     await page.click('[data-testid="send-chat-button"]');
  132 |     
  133 |     // Model should be automatically loaded and response generated
  134 |     await expect(page.locator('[data-testid="chat-response"]')).toBeVisible({ timeout: 10000 });
  135 |   });
  136 | 
  137 |   test('should persist local model configuration across app restart', async ({ page, context }) => {
  138 |     // Configure and load a model
  139 |     await page.click('[data-testid="settings-button"]');
  140 |     await page.click('[data-testid="ai-settings-tab"]');
  141 |     await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
  142 |     
  143 |     const fileChooserPromise = page.waitForEvent('filechooser');
  144 |     await page.click('[data-testid="browse-model-button"]');
  145 |     const fileChooser = await fileChooserPromise;
  146 |     await fileChooser.setFiles({
  147 |       name: 'persistent-test.gguf',
  148 |       mimeType: 'application/octet-stream',
  149 |       buffer: Buffer.from('mock persistent test model')
  150 |     });
  151 |     
  152 |     await page.click('[data-testid="save-ai-settings-button"]');
  153 |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText('Model loaded');
  154 |     await page.click('[data-testid="close-settings-button"]');
  155 |     
  156 |     // Simulate app restart by refreshing the page
  157 |     await page.reload();
  158 |     await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  159 |     
  160 |     // Check if settings are preserved
  161 |     await page.click('[data-testid="settings-button"]');
  162 |     await page.click('[data-testid="ai-settings-tab"]');
  163 |     
  164 |     // Verify provider is still Local LLM
  165 |     await expect(page.locator('[data-testid="ai-provider-select"]')).toHaveValue('local-llama');
  166 |     
  167 |     // Verify model field contains the file name
  168 |     await expect(page.locator('[data-testid="local-model-path-input"]')).toHaveValue(/persistent-test\.gguf/);
  169 |   });
  170 | });
  171 | 
  172 | test.describe('AI Settings - Error Handling', () => {
  173 |   test('should handle invalid model files gracefully', async ({ page }) => {
  174 |     await page.goto('http://localhost:1420');
  175 |     await page.click('[data-testid="settings-button"]');
  176 |     await page.click('[data-testid="ai-settings-tab"]');
  177 |     await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
  178 |     
  179 |     // Try to select an invalid file type
  180 |     const fileChooserPromise = page.waitForEvent('filechooser');
  181 |     await page.click('[data-testid="browse-model-button"]');
  182 |     const fileChooser = await fileChooserPromise;
  183 |     await fileChooser.setFiles({
  184 |       name: 'invalid-file.txt',
  185 |       mimeType: 'text/plain',
  186 |       buffer: Buffer.from('Invalid model file')
  187 |     });
  188 |     
  189 |     // Should show error or not allow the selection
  190 |     await page.click('[data-testid="save-ai-settings-button"]');
  191 |     
  192 |     // Check for error message or failure to load
  193 |     const status = page.locator('[data-testid="local-model-status"]');
  194 |     await expect(status).toContainText(/No model loaded|Error/, { timeout: 5000 });
  195 |   });
  196 | 
  197 |   test('should handle missing model file', async ({ page }) => {
  198 |     await page.goto('http://localhost:1420');
> 199 |     await page.click('[data-testid="settings-button"]');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  200 |     await page.click('[data-testid="ai-settings-tab"]');
  201 |     await page.selectOption('[data-testid="ai-provider-select"]', 'local-llama');
  202 |     
  203 |     // Type a path manually without browsing
  204 |     await page.fill('[data-testid="local-model-path-input"]', 'C:\\nonexistent\\model.gguf');
  205 |     await page.click('[data-testid="save-ai-settings-button"]');
  206 |     
  207 |     // Should show error that model couldn't be loaded
  208 |     await expect(page.locator('[data-testid="local-model-status"]')).toContainText(/No model loaded|failed/, { timeout: 5000 });
  209 |   });
  210 | });
```