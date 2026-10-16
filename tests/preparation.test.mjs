import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationSummary, preparationDate, preparationMessage, showPreparationOverview, preparationSteps} from '../docs/assets/preparation.js';

test('afgewerkte briefjes worden een controlelink; startbestand wordt de volgende stap', () => {
    const activity = {title:'Test',status:'open'};
    const prep = {wifiConfigured:true,printedAt:'2026-10-16T07:00:00Z',printedShortLink:''};
    const steps = preparationSteps(activity,prep);
    assert.equal(steps.ready,true);
    assert.equal(steps.handoutsHeading,'✓ Deelnemersbriefjes klaar');
    assert.equal(steps.handoutsLink,'Bekijken of wijzigen');
    assert.match(steps.fileHeading,/^Volgende stap:/);
    assert.equal(preparationMessage(activity,prep).next,'');
    for (const incomplete of [null, {}, {...prep,wifiConfigured:false}, {...prep,printedAt:null}]) {
        assert.equal(preparationSteps(activity,incomplete).ready,false);
    }
    assert.equal(preparationSteps({...activity,shortLink:'https://tinyurl.com/nieuw'},prep).ready,false);
    assert.equal(preparationSteps(activity,prep,{error:'offline'}).ready,false);
    assert.doesNotMatch(preparationSteps(activity,prep,{phase:'open'}).fileHeading,/Volgende stap/);
});

test('nieuwe lege activiteit verbergt overzicht; hervatten, bewaarde gegevens en fouten blijven zichtbaar', () => {
    const a = {title:'Test',status:'open'};
    assert.equal(showPreparationOverview(a, {}, {fresh:true}), false);
    assert.equal(showPreparationOverview(a, null, {fresh:true}), false);
    assert.equal(showPreparationOverview(a, {}, {fresh:false}), true);
    assert.equal(showPreparationOverview(a, {wifiConfigured:true}, {fresh:true}), true);
    assert.equal(showPreparationOverview({...a,shortLink:'https://tinyurl.com/test'}, {}, {fresh:true}), true);
    assert.equal(showPreparationOverview(a, {}, {fresh:true,error:'offline'}), true);
});
test('onderscheid tussen ontbrekende keuze, mobiele data en wifi', () => {
    assert.match(preparationSummary({}).wifi, /Nog niet bewaard/);
    assert.match(preparationSummary({}, {wifiConfigured:true,wifiName:''}).wifi, /mobiele data/);
    assert.equal(preparationSummary({}, {wifiConfigured:true,wifiName:'Zaal'}).wifi, 'Bewaard: Zaal');
    assert.match(preparationSummary({}).paper, /Nog niet bevestigd/);
});

test('nieuwe activiteit zegt niet hervatten of voorbereiding klaar', () => {
    const message = preparationMessage({title:'Test',status:'open'}, {}, {fresh:true});
    assert.match(message.heading, /Nieuwe activiteit aangemaakt/);
    assert.match(message.intro, /Nu bereiden we de deelnemersbriefjes voor/);
    assert.doesNotMatch(JSON.stringify(message), /hervat|briefjes blijven|Voorbereiding klaar/);
    assert.match(message.next, /internetgegevens/);
});
test('opnieuw openen onderscheidt onvolledige voorbereiding en klaar', () => {
    const activity = {title:'Test',status:'open'};
    assert.match(preparationMessage(activity,{}).heading, /verder afwerken/);
    const prep = {wifiConfigured:true,wifiName:'',printedAt:'2026-10-15T12:00:00Z',printedShortLink:''};
    assert.match(preparationMessage(activity,prep).heading, /Voorbereiding klaar/);
    assert.match(preparationMessage(activity,prep,{fresh:true}).heading, /Voorbereiding klaar/);
    assert.match(preparationMessage({...activity,shortLink:'https://tinyurl.com/nieuw'},prep).heading, /verder afwerken/);
});
test('wifi zonder papieren bevestiging is nog niet klaar; korte link is optioneel', () => {
    const activity = {title:'Test',status:'open'};
    const message = preparationMessage(activity,{wifiConfigured:true});
    assert.match(message.heading, /verder afwerken/);
    assert.match(message.next, /werkelijk op papier/);
});
test('laden en fouten doen geen uitspraak dat voorbereiding klaar is', () => {
    const a = {title:'Test',status:'open'};
    assert.match(preparationMessage(a,null,{fresh:true}).intro, /halen/);
    assert.match(preparationMessage(a,{}, {error:'offline'}).intro, /niet worden gecontroleerd/);
});
test('lopende ronde, eindanalyse en afgesloten activiteit hebben eigen aanwijzingen', () => {
    const a = {title:'Test',status:'open'};
    for (const phase of ['open','locked','revealed']) assert.match(preparationMessage(a,{}, {fresh:true,phase}).heading, /Quiz bezig/);
    assert.match(preparationMessage(a,{}, {phase:'finished'}).heading, /Ronde afgelopen/);
    assert.match(preparationMessage({...a,status:'closed'},{}).heading, /Activiteit afgesloten/);
});
test('alleen bevestigde briefjes met actuele link tellen als klaar', () => {
    const prep = {printedAt:'2026-10-15T12:30:00Z',printedShortLink:'https://tinyurl.com/a'};
    assert.equal(preparationSummary({shortLink:prep.printedShortLink},prep).printed,true);
    assert.equal(preparationSummary({shortLink:'https://tinyurl.com/b'},prep).printed,false);
    assert.equal(preparationSummary({shortLink:prep.printedShortLink},{...prep,printedAt:null}).printed,false);
    assert.equal(preparationDate('ongeldig'), '');
});
