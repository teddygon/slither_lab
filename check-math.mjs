import assert from 'node:assert/strict';
import {diagram, ambientFor, subordinate, normalize, solve, prune, validate, moveAt, generatePair} from './math.js';

// Independent oracle: generate every face using the facet substitutions,
// then lift replacements through bound positions by composition.
function faces(c) {
  const seen=new Set([c]), queue=[c];
  const rules={'<0':['L<'],'0>':['>L'],'<1':['C<'],'1>':['>C'],'01':['><'],'10':['><'],'<>':['LC','CL']};
  for(let q=0;q<queue.length;q++) {
    const w=queue[q], free=[...w].map((ch,i)=>'LC'.includes(ch)?-1:i).filter(i=>i>=0);
    const add=s=>{if(!seen.has(s)){seen.add(s);queue.push(s);}};
    for(let k=0;k<free.length;k++) {
      const i=free[k];
      if('01'.includes(w[i])) add(w.slice(0,i)+(w[i]==='0'?'L':'C')+w.slice(i+1));
      if(k+1<free.length) {
        const j=free[k+1];
        for(const pair of rules[w[i]+w[j]]||[]) add(w.slice(0,i)+pair[0]+w.slice(i+1,j)+pair[1]+w.slice(j+1));
      }
    }
  }
  return seen;
}
let count=0, pairs=0, prep=0, digit=0, generated=0, seed=415;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let n=0;n<=6;n++) {
  for(let bits=0;bits<2**n;bits++) {
    const c='<'+(n?bits.toString(2).padStart(n,'0'):'')+'>', ambient=ambientFor(c), fs=faces(c), groups=new Map();
    for(const w of fs) {
      assert(subordinate(w,ambient), `Oracle face rejected: ${c} / ${w}`);
      let result;try {result=normalize(w,ambient);} catch(e) {throw new Error(`${c} / ${w}: ${e.message}`);}
      for(const m of result.moves) {
        assert(fs.has(m.to),`Move not a face: ${c} / ${m.to}`);
        assert(fs.has(m.witness),`Witness not a face: ${c} / ${m.witness}`);
        assert.equal(prune(m.to),prune(w));
        if(m.kind==='Tongue flip') prep++;
        if(m.kind==='Scale-boundary slide') digit++;
      }
      const a=prune(w);if(!groups.has(a))groups.set(a,[]);groups.get(a).push(w);
      count++;
    }
    for(let sample=0;sample<4;sample++) {
      const pair=generatePair(c,random);
      assert.notEqual(pair.f,pair.g);
      assert.equal(pair.c,c);assert.equal(prune(pair.f),prune(pair.g));
      assert(fs.has(pair.f),`Generated f is not an oracle face: ${c} / ${pair.f}`);
      assert(fs.has(pair.g),`Generated g is not an oracle face: ${c} / ${pair.g}`);
      const path=solve(pair);assert.equal(path.words.at(-1),pair.g);
      generated++;
    }
    for(const [a, ws] of groups) {
      // Exercise both directions of the proof, including different leftmost tails.
      for(let i=0;i<ws.length;i++) {
        const f=ws[i],g=ws[(i+Math.ceil(ws.length/2))%ws.length];
        let r;try{r=solve({a,c,f,g,ambient});}catch(e){throw new Error(`${c} / ${f} -> ${g}: ${e.message}`);}
        assert.equal(r.words.at(-1),g);
        r.moves.forEach(m=>{assert(fs.has(m.to));assert(fs.has(m.witness));assert.equal(prune(m.to),a);});
        pairs++;
      }
    }
  }
}
// For small snakes, compare the geometric validity test against ALL grammatical
// words of the same length, not merely known faces.
for(const c of ['<>','<0>','<1>','<01>','<10>','<001>','<101>']) {
  const fs=faces(c),amb=ambientFor(c);
  function words(w='',open=false) {
    if(w.length===c.length) {if(!open)assert.equal(subordinate(w,amb),fs.has(w),`${c} / ${w}`);return;}
    for(const ch of open?'01>LC':'<LC') words(w+ch,ch==='<'?true:ch==='>'?false:open);
  }
  words();
}
assert.throws(()=>validate('<01>','<>LC','L<0>'), /domains differ/);
assert.throws(()=>validate('<01>','<>LL','<>LL'), /not subordinate/);
assert.equal(solve(validate('<><>','<><>','<><>')).reachable,true);
assert.equal(diagram('<L>C').height,2);
assert.equal(validate('01','xLyC','LxCy').a,'<>');
for(const c of ['<'+'0'.repeat(158)+'>','<'+'1'.repeat(158)+'>','<'+'01'.repeat(79)+'>']) {
  const pair=generatePair(c,random),path=solve(pair);
  assert.notEqual(pair.f,pair.g);assert.equal(path.words.at(-1),pair.g);generated++;
}
assert.throws(()=>generatePair('<0L>'),/snake den/);
assert.throws(()=>generatePair('0'.repeat(159)),/160 letters/);
console.log(JSON.stringify({facesChecked:count,transformationsChecked:pairs,generatedPairsChecked:generated,tonguePreparationMoves:prep,scaleBoundaryMoves:digit,status:'passed'}));
