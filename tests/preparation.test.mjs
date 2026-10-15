import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationSummary, preparationDate} from '../docs/assets/preparation.js';
test('onderscheid tussen ontbrekende keuze, mobiele data en wifi', () => {
    assert.match(preparationSummary({}).wifi, /Nog niet bewaard/);
    assert.match(preparationSummary({}, {wifiConfigured:true,wifiName:''}).wifi, /mobiele data/);
    assert.equal(preparationSummary({}, {wifiConfigured:true,wifiName:'Zaal'}).wifi, 'Bewaard: Zaal');
    assert.match(preparationSummary({}).paper, /Nog niet bevestigd/);
});
test('alleen bevestigde briefjes met actuele link tellen als klaar', () => {
    const prep = {printedAt:'2026-10-15T12:30:00Z',printedShortLink:'https://tinyurl.com/a'};
    assert.equal(preparationSummary({shortLink:prep.printedShortLink},prep).printed,true);
    assert.equal(preparationSummary({shortLink:'https://tinyurl.com/b'},prep).printed,false);
    assert.equal(preparationSummary({shortLink:prep.printedShortLink},{...prep,printedAt:null}).printed,false);
    assert.equal(preparationDate('ongeldig'), '');
});
