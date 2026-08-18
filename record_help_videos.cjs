const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('Launching browser in HEADED mode for debugging...');
    const browser = await chromium.launch({
        headless: false, // Show the browser so we can see what's happening
        args: ['--ignore-certificate-errors'],
        slowMo: 500 // Slow down actions so they're visible
    });

    // Ensure output directory exists
    if (!fs.existsSync('public/help')) {
        fs.mkdirSync('public/help', { recursive: true });
    }

    const baseUrl = 'http://localhost:1420';

    async function record(name, action) {
        console.log(`\n=== Recording ${name} ===`);
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            recordVideo: { dir: 'public/help', size: { width: 1280, height: 800 } }
        });
        const page = await context.newPage();

        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || type === 'warning') {
                console.log(`[${name}] PAGE ${type.toUpperCase()}: ${text}`);
            }
        });
        page.on('pageerror', exception => {
            console.error(`[${name}] PAGE CRASH:`, exception.message);
        });

        try {
            console.log(`Navigating to ${baseUrl}...`);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            console.log('Waiting for React to mount...');
            // Wait for the root div to have content
            await page.waitForFunction(() => {
                const root = document.getElementById('root');
                return root && root.children.length > 0;
            }, { timeout: 15000 });

            console.log('Waiting for navbar...');
            await page.waitForSelector('nav', { timeout: 15000 });

            // Extra wait for hydration
            await page.waitForTimeout(2000);

            console.log('App loaded successfully! Starting action...');
            await action(page);

            console.log('Action complete, capturing final state...');
            await page.waitForTimeout(2000);

            const videoPath = await page.video().path();
            console.log(`Raw video saved to: ${videoPath}`);

            await page.close();
            await context.close();

            // Rename
            await new Promise(r => setTimeout(r, 1500));
            const targetPath = `public/help/${name}.webm`;
            if (fs.existsSync(targetPath)) {
                console.log(`Removing existing ${targetPath}...`);
                fs.unlinkSync(targetPath);
            }

            console.log(`Copying to ${targetPath}...`);
            fs.copyFileSync(videoPath, targetPath);
            fs.unlinkSync(videoPath);

            console.log(`✓ Successfully saved ${targetPath}`);
            return true;
        } catch (e) {
            console.error(`✗ Error recording ${name}:`, e.message);
            await page.screenshot({ path: `error_${name}.png`, fullPage: true });
            fs.writeFileSync(`error_${name}.html`, await page.content());
            await page.close();
            await context.close();
            return false;
        }
    }

    // Record select_packages
    const success1 = await record('select_packages', async (page) => {
        console.log('  Finding search input...');
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.waitFor({ state: 'visible', timeout: 10000 });

        console.log('  Typing "firefox"...');
        await searchInput.fill('firefox');

        console.log('  Pressing Enter...');
        await page.keyboard.press('Enter');

        console.log('  Waiting for results...');
        await page.waitForSelector('.package-card', { timeout: 15000 });
        await page.waitForTimeout(1000);

        console.log('  Clicking Add to Cart...');
        const addButton = page.locator('button[title="Add to Cart"]').first();
        await addButton.waitFor({ state: 'visible', timeout: 10000 });
        await addButton.click();

        console.log('  Done!');
        await page.waitForTimeout(1500);
    });

    if (success1) {
        // Record open_cart
        await record('open_cart', async (page) => {
            console.log('  Pre-populating cart with an item...');
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('vlc');
            await page.keyboard.press('Enter');
            await page.waitForSelector('.package-card', { timeout: 15000 });

            const addButton = page.locator('button[title="Add to Cart"]').first();
            await addButton.click();
            await page.waitForTimeout(1000);

            console.log('  Opening cart...');
            // Find cart button by looking for the shopping bag icon
            const cartButton = page.locator('nav button').filter({
                has: page.locator('svg.lucide-shopping-bag')
            });
            await cartButton.waitFor({ state: 'visible', timeout: 10000 });
            await cartButton.click();

            console.log('  Cart opened!');
            await page.waitForTimeout(3000);
        });
    }

    await browser.close();
    console.log('\n=== Recording complete! ===');
})();
