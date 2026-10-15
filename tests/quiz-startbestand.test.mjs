import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeQuizStartFile } from '../docs/assets/quiz-startbestand.js';

test('startbestand opent precies de bestaande activiteit met privésleutel', () => {
    const url = 'https://fredje4711.github.io/live-diabetes-quiz/quizmaster.html?a=123456abcdef#beheer=' + 'a'.repeat(64);
    const file = makeQuizStartFile('Ledenfeest', url, '2026-10-15T12:30:00Z');
    assert.equal(file.filename, 'Quiz Ledenfeest openen.html');
    let opened;
    const script = file.html.match(/<script>([\s\S]*?)<\/script>/)[1];
    vm.runInNewContext(script, { window: {location: {replace: value => {opened = value;}}} });
    assert.equal(new URL(opened).search, new URL(url).search);
    const hash = new URLSearchParams(new URL(opened).hash.slice(1));
    assert.equal(hash.get('beheer'), 'a'.repeat(64));
    assert.equal(hash.get('startbestand'), '2026-10-15T12:30:00.000Z');
    assert.ok(file.html.includes('15 oktober 2026'));
    assert.ok(file.html.includes('14:30'));
    assert.ok(file.html.includes('Mijn quiz openen'));
    assert.ok(file.html.includes('Niet delen met deelnemers'));
    assert.doesNotMatch(file.html, /<script[^>]+src=/);
});
test('activiteitsnaam kan geen HTML of ongeldige bestandsnaam injecteren', () => {
    const file = makeQuizStartFile('</h1><script>alert(1)</script>:feest?', 'https://example.com/quizmaster.html?a=abc&x=1#beheer=key');
    assert.equal((file.html.match(/<script>/g) || []).length, 1);
    assert.ok(file.html.includes('&lt;script&gt;'));
    assert.doesNotMatch(file.filename, /[<>:"/\\|?*]/);
    assert.ok(file.html.includes('a=abc&amp;x=1'));
    assert.throws(() => makeQuizStartFile('Quiz', 'javascript:alert(1)'));
});
