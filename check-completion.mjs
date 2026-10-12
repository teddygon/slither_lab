// Actual UI module with a DOM stub: state progression, fixed target, dens,
// final bound letters, random generation, and recovery (not browser QA).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {solve,validate} from './math.js';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),elements=new Map();
for(const tag of html.matchAll(/<(?:[^>"']|"[^"]*"|'[^']*')+>/g)){
  const attrs=tag[0],id=attrs.match(/\bid="([^"]+)"/)?.[1];if(!id)continue;
  const listeners=new Map();elements.set(id,{
    value:attrs.match(/\bvalue="([^"]*)"/)?.[1]||'',checked:attrs.includes(' checked'),hidden:attrs.includes(' hidden'),disabled:false,textContent:'',innerHTML:'',
    open:false,showModal(){this.open=true;},close(){this.open=false;this.fire('close');},focus(){this.focused=true;},classList:{toggle(){}},setAttribute(){},addEventListener(type,fn){listeners.set(type,fn);},fire(type){listeners.get(type)?.({preventDefault(){},target:this});}
  });
}
const get=id=>{assert(elements.has(id),`Unknown element ${id}`);return elements.get(id);};
const letters=id=>[...get(id).innerHTML.matchAll(/<span class="char">([^<]*)<\/span>/g)].map(m=>m[1]).join('');
const display=w=>w.replace(/</g,'⟨').replace(/>/g,'⟩')||'ε';
get('speed').value='1400';get('diagram-size').value='fit';
globalThis.document={getElementById:get,addEventListener(){}};
let tick=null;globalThis.setInterval=fn=>{tick=fn;return 1;};globalThis.clearInterval=()=>{tick=null;};
await import('./app.js');

assert(get('intro-dialog').open);
get('intro-dismiss').fire('click');
assert(!get('intro-dialog').open);assert(get('play').focused);
const original=solve(validate('<0111000110>','LC<CC0>LCLCL','<0>CCLCLLCLC'));
const targetSVG=get('target-diagram').innerHTML,targetWord=get('target-word').innerHTML;
assert.equal(letters('current-word'),display(original.f));assert.equal(letters('target-word'),display(original.g));
assert.equal(get('step-counter').textContent,`0 / ${original.moves.length} moves`);
assert(get('component-info').hidden);
get('play').fire('click');
for(let step=1;step<=original.moves.length;step++){
  assert(tick,'Playback stopped before reaching g.');tick();
  assert.equal(letters('current-word'),display(original.words[step]));
  assert.equal(get('target-diagram').innerHTML,targetSVG,'The target diagram changed during playback.');
  assert.equal(get('target-word').innerHTML,targetWord,'The target word changed during playback.');
  assert.equal(get('step-counter').textContent,`${step} / ${original.moves.length} moves`);
}
assert.equal(tick,null);assert(get('next').disabled);assert.equal(get('current-state').textContent,'g reached');
assert(get('certificate-body').innerHTML.includes('h ='),'The final move must still have a certificate.');
get('previous').fire('click');assert.equal(letters('current-word'),display(original.words.at(-2)));
get('play').fire('click');tick();assert.equal(letters('current-word'),display(original.g));
get('first').fire('click');assert.equal(letters('current-word'),display(original.f));
get('step-slider').value='2';get('step-slider').fire('input');assert.equal(letters('current-word'),display(original.words[2]));
assert.equal(get('target-diagram').innerHTML,targetSVG);
get('last').fire('click');assert.equal(letters('current-word'),display(original.g));

function input(c,f,g){get('codomain').value=c;get('from-word').value=f;get('to-word').value=g;get('slither-form').fire('submit');assert(get('error').hidden,get('error').textContent);}
input('<0111000110>','<0>CCLCLLCCL','<0>CCLCLLCLC');
assert.equal(get('step-slider').max,'1');assert(!get('play').disabled);
assert.equal(letters('current-word'),'⟨0⟩CCLCLLCCL');assert.equal(letters('target-word'),'⟨0⟩CCLCLLCLC');
get('play').fire('click');tick();assert.equal(letters('current-word'),'⟨0⟩CCLCLLCLC');
assert(get('next').disabled);

input('<>','LC','CL');get('next').fire('click');assert.equal(letters('current-word'),'CL');
get('play').fire('click');assert.equal(letters('current-word'),'LC');assert.equal(letters('target-word'),'CL');tick();assert.equal(letters('current-word'),'CL');
input('<01>','<01>','<01>');assert(get('play').disabled);assert.equal(get('step-slider').max,'0');
input('ε','ε','ε');assert(get('play').disabled);assert.equal(letters('target-word'),'ε');
get('random-pair').fire('click');assert(!get('error').hidden);

input('<><>','<>LC','LC<>');
assert.equal(letters('current-word'),'⟨⟩LC');assert.equal(letters('target-word'),'LC⟨⟩');
assert.equal(get('step-counter').textContent,'No move path');assert(get('play').disabled);assert(get('last').disabled);
assert.equal(get('component-info').open,true);assert.equal(get('error').hidden,true);
assert(!get('move-title').textContent.includes('reached'));

let seed=415;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
get('codomain').value='<01><10>';get('random-pair').fire('click');
assert.equal(get('codomain').value,'<01><10>');assert.notEqual(get('from-word').value,get('to-word').value);
assert(get('error').hidden);
assert.equal(letters('target-word'),display(get('to-word').value));
get('last').fire('click');assert.equal(letters('current-word'),letters('target-word'));
get('codomain').value='<0L>';get('random-pair').fire('click');assert(!get('error').hidden);
get('codomain').value='<0101>';get('random-pair').fire('click');assert(get('error').hidden);
assert(!get('play').disabled);assert(get('component-info').hidden);
get('lecture-example').fire('click');
assert.equal(letters('current-word'),display(original.f));
assert.equal(letters('target-word'),display(original.g));
assert.equal(get('step-slider').value,'0');
get('last').fire('click');
assert.equal(letters('current-word'),display(original.g));
console.log('UI passed: opening popup, lecture reset, fixed target at every state, component moves, final L/C matching, single/empty cases, obstruction display, random dens, navigation and recovery.');
