import assert from 'node:assert/strict';
import {ambientFor,subordinate,solve,validate,moveAt,prune,componentAssignments,generatePair} from './math.js';

// Independent list of faces from facet substitutions on a product of snakes.
function faces(c){
  const seen=new Set([c]),queue=[c],rules={'<0':['L<'],'0>':['>L'],'<1':['C<'],'1>':['>C'],'01':['><'],'10':['><'],'<>':['LC','CL']};
  for(let q=0;q<queue.length;q++){
    const w=queue[q],free=[...w].flatMap((ch,i)=>'LC'.includes(ch)?[]:[i]);
    const add=s=>{if(!seen.has(s)){seen.add(s);queue.push(s);}};
    for(let k=0;k<free.length;k++){
      const i=free[k],j=free[k+1];
      if('01'.includes(w[i]))add(w.slice(0,i)+(w[i]==='0'?'L':'C')+w.slice(i+1));
      if(j!==undefined)for(const s of rules[w[i]+w[j]]||[])add(w.slice(0,i)+s[0]+w.slice(i+1,j)+s[1]+w.slice(j+1));
    }
  }
  return seen;
}

let facesChecked=0,pathsChecked=0,obstructionsChecked=0,edgesChecked=0;
for(const c of ['<><>','<0><>','<><1>','<01><>','<><10>','<0><1>','<01><10>','<><><>','<0><><1>','<00><11>']){
  const fs=faces(c),amb=ambientFor(c),parent=new Map([...fs].map(w=>[w,w]));
  const root=w=>{let r=w;while(parent.get(r)!==r)r=parent.get(r);while(w!==r){const p=parent.get(w);parent.set(w,r);w=p;}return r;};
  const groups=new Map(),signatures=new Map();
  for(const w of fs){
    assert(subordinate(w,amb));facesChecked++;
    const a=prune(w),signature=JSON.stringify(componentAssignments(c,w,w).map(p=>p.domainF));
    if(!groups.has(a))groups.set(a,[]);groups.get(a).push(w);
    if(!signatures.has(signature))signatures.set(signature,[]);signatures.get(signature).push(w);
    for(let i=0;i<w.length;i++)for(let j=i+1;j<w.length;j++){
      const m=moveAt(w,i,j,amb);if(!m)continue;
      assert(fs.has(m.to));assert(fs.has(m.witness));assert.equal(prune(m.to),a);
      parent.set(root(w),root(m.to));edgesChecked++;
    }
  }
  function check(f,g){
    const input=validate(c,f,g),r=solve(input),connected=root(f)===root(g);
    assert.equal(r.reachable,connected,`${c}: ${f} -> ${g}`);
    if(!connected){assert(r.obstruction.length);assert.equal(r.words[0],f);assert.equal(r.g,g);obstructionsChecked++;return;}
    assert.equal(r.words.at(-1),g);
    for(const [i,m] of r.moves.entries()){
      assert.equal(m.from,r.words[i]);assert.equal(m.to,r.words[i+1]);
      assert(fs.has(m.to));assert(fs.has(m.witness));
      const part=input.components[m.component-1];assert(part);
      assert(m.i>=part.start&&m.j<part.end,'A move crossed an ambient join.');
      assert.deepEqual(componentAssignments(c,m.to,m.to).map(p=>p.domainF),input.components.map(p=>p.domainF));
    }
    pathsChecked++;
  }
  for(const ws of groups.values())for(let i=0;i<ws.length;i++)check(ws[i],ws[(i+Math.ceil(ws.length/2))%ws.length]);
  for(const ws of signatures.values())for(let i=0;i<ws.length;i++)check(ws[i],ws[(i+Math.ceil(ws.length/2))%ws.length]);
}
const blocked=solve(validate('<><>','<>LC','LC<>'));
assert.equal(blocked.reachable,false);assert.equal(blocked.obstruction.length,2);
assert.equal(solve(validate('ε','ε','ε')).reachable,true);
assert.throws(()=>generatePair('ε'),/no distinct random pair/);
let seed=415;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
let generated=0;
for(const c of ['<><>','<01><10>','<0><><1>','<>'.repeat(80),'<01>'.repeat(40)])for(let i=0;i<8;i++){
  const pair=generatePair(c,random),r=solve(pair);assert.notEqual(pair.f,pair.g);assert(r.reachable);assert.equal(r.words.at(-1),pair.g);generated++;
}
assert(pathsChecked>0&&obstructionsChecked>0);
console.log({facesChecked,pathsChecked,obstructionsChecked,edgesChecked,generated,status:'passed'});
