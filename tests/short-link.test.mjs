import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeShortLink, handoutAddress } from '../docs/assets/short-link.js';

test('TinyURL normaliseren, leeg laten en hoofdletters in alias behouden', () => {
    assert.equal(normalizeShortLink('  tinyurl.com/Abc-123  '), 'https://tinyurl.com/Abc-123');
    assert.equal(normalizeShortLink('https://www.tinyurl.com/quiz_123'), 'https://tinyurl.com/quiz_123');
    assert.equal(normalizeShortLink('www.tinyurl.com/3vpjz6xk'), 'https://tinyurl.com/3vpjz6xk');
    assert.equal(normalizeShortLink('tinyurl.com/3vpjz6xk'), 'https://tinyurl.com/3vpjz6xk');
    assert.equal(normalizeShortLink('https://tinyurl.com/3vpjz6xk'), 'https://tinyurl.com/3vpjz6xk');
    assert.equal(normalizeShortLink('  '), '');
});
test('geen privélinks, onveilige adressen of misleidende domeinen', () => {
    for (const value of ['javascript:alert(1)', 'http://tinyurl.com/abc', 'https://tinyurl.com.evil.com/abc',
        'https://evil.com/abc', 'https://tinyurl.com/', 'https://tinyurl.com/abc#beheer=secret',
        'https://tinyurl.com/abc?key=secret', 'https://user:pass@tinyurl.com/abc',
        'https://fredje4711.github.io/live-diabetes-quiz/quizmaster.html?a=abcdef123456#beheer=secret']) {
        assert.throws(() => normalizeShortLink(value), value);
    }
});
test('briefje gebruikt korte link of volledige oorspronkelijke deelnemerslink', () => {
    const original = 'https://fredje4711.github.io/live-diabetes-quiz/deelnemer.html?a=82598bd84484';
    assert.equal(handoutAddress(original), 'fredje4711.github.io/live-diabetes-quiz/deelnemer.html?a=82598bd84484');
    assert.equal(handoutAddress(original, 'https://tinyurl.com/2xuwuo5z'), 'tinyurl.com/2xuwuo5z');
    assert.equal(handoutAddress(original, 'https://www.tinyurl.com/3vpjz6xk'), 'tinyurl.com/3vpjz6xk');
    const source = fs.readFileSync('docs/assets/briefje.js', 'utf8');
    assert.match(source, /renderQr\(target.querySelector\(".handout-quiz-qr"\), joinLink\(\), 145\)/);
    assert.match(source, /saveActivityShortLink\(activityId, value\)/);
    assert.match(source, /printButton.disabled = !ready \|\| saving \|\| dirty/);
});

test('invoervak en ieder briefje leggen het adres zonder www of https uit', () => {
    const html = fs.readFileSync('docs/briefje.html', 'utf8');
    assert.match(html, /aria-describedby="shortLinkInputHelp shortLinkHelp"/);
    assert.match(html, /Met of zonder <strong>https:\/\/<\/strong> is allebei goed/);
    const template = html.match(/<template id="handoutTemplate">([\s\S]*?)<\/template>/)[1];
    assert.match(template, /Typ dit adres in de adresbalk van uw browser/);
    assert.match(template, /Typ het precies zoals hierboven\. U hoeft er geen <strong>www\.<\/strong> of <strong>https:\/\/<\/strong> vóór te zetten/);
    assert.doesNotMatch(template, /adresbalk van Google/);
});
