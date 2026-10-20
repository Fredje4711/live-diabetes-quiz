import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {footerVisible} from '../docs/assets/author-footer.js';
test('organisator heeft footer; publiek alleen tijdens afgesproken fasen',()=>{
    assert.equal(footerVisible('organizer'),true);
    for (const role of ['participant','projector']) {
        assert.equal(footerVisible(role),false);
        assert.equal(footerVisible(role,{waiting:true}),true);
        assert.equal(footerVisible(role,{closed:true}),true);
    }
    assert.equal(footerVisible('participant',{finished:true}),true);
    assert.equal(footerVisible('projector',{finished:true}),false);
});
test('alle actieve uitleg en bediening gebruiken één compacte footer; geen printfooter',()=>{
    for (const file of ['start.html','index.html','kennismaken.html','handleiding.html','briefje.html','quizmaster.html','deelnemer.html','projectie.html','uitleg/oefenen.html','uitleg/organiseren.html']) {
        const html=fs.readFileSync(new URL('../docs/'+file,import.meta.url),'utf8');
        assert.equal((html.match(/src="(?:\.\.\/)?assets\/author-footer\.js\?v=1"/g)||[]).length,1,file);
    }
    const css=fs.readFileSync(new URL('../docs/assets/author-footer.css',import.meta.url),'utf8');
    assert.match(css,/margin-top: 2px/);
    assert.match(css,/@media print/);
});
