// Offline browser check: no live activity or backend is accessed.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({headless:true, executablePath:process.env.QUIZ_TEST_CHROME});
    try {
        const page = await browser.newPage({viewport:{width:1280,height:720}});
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            const file = path.join(__dirname, '../docs', decodeURIComponent(url.pathname));
            if (url.hostname !== 'quiz.test' || /assets\/(deelnemer|projectie)\.js/.test(url.pathname))
                return route.fulfill({contentType:'text/javascript',body:''});
            const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html';
            return route.fulfill({contentType,body:fs.readFileSync(file)});
        });
        for (const audience of ['projectie','deelnemer']) {
            await page.goto(`http://quiz.test/${audience}.html`);
            await page.waitForSelector('#authorFooter', {state:'attached'});
            const projector = audience === 'projectie';
            const waiting = projector ? 'projectorWaiting' : 'waitingParticipant';
            const finished = projector ? 'projectorFinished' : 'finishedParticipant';
            await page.evaluate(({waiting,projector}) => {
                document.querySelector('#activityNotice').classList.add('hide');
                if (!projector) document.querySelector('#quizPanel').classList.remove('hide');
                document.getElementById(waiting).classList.remove('hide');
            }, {waiting,projector});
            await page.waitForFunction(() => !document.querySelector('#authorFooter').hidden);
            await page.evaluate(waiting => document.getElementById(waiting).classList.add('hide'),waiting);
            await page.waitForFunction(() => document.querySelector('#authorFooter').hidden);
            await page.evaluate(finished => document.getElementById(finished).classList.remove('hide'),finished);
            await page.waitForFunction(expected => document.querySelector('#authorFooter').hidden === expected,projector);
            await page.evaluate(({finished,projector}) => {
                document.getElementById(finished).classList.add('hide');
                const notice = document.querySelector('#activityNotice');
                notice.classList.remove('hide');
                notice.classList.add(projector ? 'is-farewell' : 'is-closed');
                notice.innerHTML = '<h1><span class="farewell-thanks">Bedankt</span> <span class="farewell-subtitle">voor uw deelname aan de quiz!</span></h1><p>Fijn dat u erbij was.</p>';
            },{finished,projector});
            await page.waitForFunction(() => !document.querySelector('#authorFooter').hidden);
            console.log(audience, await page.evaluate(() => ({height:document.documentElement.scrollHeight,viewport:innerHeight,gap:getComputedStyle(document.querySelector('#authorFooter p+p')).marginTop})));
            if (projector) assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),true,'thank-you screen and footer fit without scrolling');
            if (projector && process.env.QUIZ_TEST_SCREENSHOT) await page.screenshot({path:process.env.QUIZ_TEST_SCREENSHOT,fullPage:true});
            await page.emulateMedia({media:'print'});
            assert.equal(await page.locator('#authorFooter').isVisible(),false);
            await page.emulateMedia({media:'screen'});
        }
        console.log('Footer visibility checked: waiting, questions, results, closure and print.');
    } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
