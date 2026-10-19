// Read-only UI regression check; no Firebase connection or real quiz is created.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../docs');
(async () => {
    const browser = await chromium.launch({headless:true, ...(process.env.QUIZ_TEST_CHROME ? {executablePath:process.env.QUIZ_TEST_CHROME} : {})});
    try {
        const page = await browser.newPage({viewport:{width:1366,height:900}});
        const html = fs.readFileSync(path.join(root,'quizmaster.html'),'utf8')
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')
            .replace(/<link\b[^>]*>/g,'').replace(/<img\b[^>]*>/g,'');
        await page.setContent(html);
        await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets/styles.css'),'utf8')});
        const helpers = fs.readFileSync(path.join(root,'assets/preparation.js'),'utf8').replace(/export function/g,'function');
        const source = fs.readFileSync(path.join(root,'assets/quizmaster.js'),'utf8');
        const render = source.slice(source.indexOf('function renderPreparation()'),source.indexOf('let savedIdentity'));
        await page.addScriptTag({content:helpers + `
            let activityId='test', activityState={title:'Testquiz',roundNumber:1}, preparation={}, preparationError='',
                activityCreatedHere=true, latestState={session:{phase:'waiting'}}, startFileStamp=null, preparationLayoutKey='';
            const managementPanel=document.querySelector('#managementPanel');
            document.querySelector('#loadingPanel').classList.add('hide');
            document.querySelector('#controlPanel').classList.remove('hide');
            managementPanel.classList.remove('hide');
            ${render}
            document.querySelector('#toggleVenue').addEventListener('click', () => setVenueExpanded(document.querySelector('#venueContent').classList.contains('hide')));
            renderPreparation();
        `});
        assert.equal(await page.locator('#managementPanel').getAttribute('open'), '');
        await page.evaluate(`preparation={wifiConfigured:true,printedAt:'2026-10-19T10:00:00Z',printedShortLink:''}; renderPreparation()`);
        assert.equal(await page.locator('#saveManagementLink').isVisible(),true);
        await page.evaluate(`startFileStamp='2026-10-19T10:00:00Z'; renderPreparation()`);
        assert.equal(await page.locator('#saveManagementLink').isVisible(),false);
        assert.equal(await page.locator('#openProjectorLink').isVisible(),true);
        assert.equal(await page.locator('#toggleVenue').isVisible(),false);
        await page.locator('#venueNextHeading').click();
        assert.equal(await page.locator('#openProjectorLink').isVisible(),true, 'heading cannot collapse the next steps before the start');
        assert.equal(await page.locator('#copyParticipantLink').isVisible(),false);
        if (process.env.QUIZ_TEST_SCREENSHOT) await page.screenshot({path:process.env.QUIZ_TEST_SCREENSHOT,fullPage:true});
        await page.getByText('Deelnemers op afstand laten meespelen',{exact:true}).click();
        assert.equal(await page.locator('#copyParticipantLink').isVisible(),true);
        await page.locator('#preparationToggle').click();
        await page.evaluate('renderPreparation()');
        assert.equal(await page.locator('#saveManagementLink').isVisible(),true, 'live update preserves manual expansion');
        await page.evaluate(`latestState.session.phase='open'; renderPreparation()`);
        assert.equal(await page.locator('#openProjectorLink').isVisible(),false);
        await page.locator('#toggleVenue').click();
        assert.equal(await page.locator('#openProjectorLink').isVisible(),true);
        await page.evaluate('renderPreparation()');
        assert.equal(await page.locator('#openProjectorLink').isVisible(),true, 'manual expansion survives live updates');
        await page.locator('#toggleVenue').click();
        assert.equal(await page.locator('#saveManagementLink').isVisible(),false);
        assert.equal(await page.locator('#closeActivityButton').count(),1);
        await page.evaluate(`latestState.session.phase='waiting'; renderPreparation()`);
        assert.equal(await page.locator('#openProjectorLink').isVisible(),true);
        for (const width of [1366,390]) {
            await page.setViewportSize({width,height:900});
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`no horizontal overflow at ${width}px`);
        }
        console.log('UI checked: preparation, ready, saved file, live round, restart, optional links, manual expansion and mobile layout. No backend accessed.');
    } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
