// Slither words and their allowed elementary diagram moves.
// L = loop (east); C = coloop (north). Indices are zero-based internally.
export const bound = c => c === 'L' || c === 'C';
export const prune = w => w.replace(/[LC]/g, '');
export const pretty = w => w.replace(/</g, '⟨').replace(/>/g, '⟩');
export function parse(value, label = 'Word', codomain = false) {
  let w = value.trim().replace(/\s/g, '').replace(/[⟨〈(x]/g, '<').replace(/[⟩〉)y]/g, '>').replace(/[ℓl→]/g, 'L').replace(/[c↑]/g, 'C');
  if (/^(?:ε|ϵ|∅)$/.test(w)) w = '';
  if (codomain && /^[01]+$/.test(w)) w = '<' + w + '>';
  let open = false;
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (!'< >01LC'.replace(' ', '').includes(ch)) throw new Error(`${label}: unrecognized symbol “${ch}” at position ${i + 1}. Use < > 0 1 L C.`);
    if (ch === '<') { if (open) throw new Error(`${label}: components cannot be nested (position ${i + 1}).`); open = true; }
    if (ch === '>') { if (!open) throw new Error(`${label}: closing bracket at position ${i + 1} has no opening bracket.`); open = false; }
    if ((ch === '0' || ch === '1') && !open) throw new Error(`${label}: ${ch} at position ${i + 1} must lie inside a bracket pair.`);
  }
  if (open) throw new Error(`${label}: a closing bracket is missing.`);
  if (codomain && !/^(?:<[01]*>)*$/.test(w)) throw new Error('The codomain c must be a snake den: one or more <binary word> components, or ε. It cannot contain L or C.');
  return w;
}

const key = (x, y, d) => `${x},${y},${d}`;
export function diagram(w) {
  let nodes = [[0, 0]];
  const edges = [], layers = [[[0, 0]]];
  function edge(p, d, i, component) {
    const q = [p[0] + (d === 'E' ? 1 : 0), p[1] + (d === 'N' ? 1 : 0)];
    edges.push({x:p[0], y:p[1], d, i, component, key:key(...p,d)});
    return q;
  }
  let component = -1;
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (ch === '<') {
      component++;
      nodes = [edge(nodes[0], 'N', i, component), edge(nodes[0], 'E', i, component)];
    } else if (ch === '>') {
      const q = edge(nodes[0], 'E', i, component);
      edge(nodes[1], 'N', i, component); nodes = [q];
    } else if (ch === '0') {
      const upper = edge(nodes[0], 'E', i, component);
      edge(nodes[1], 'N', i, component);
      nodes = [upper, edge(nodes[1], 'E', i, component)];
    } else if (ch === '1') {
      const lower = edge(nodes[1], 'N', i, component);
      edge(nodes[0], 'E', i, component);
      nodes = [edge(nodes[0], 'N', i, component), lower];
    } else {
      nodes = nodes.map(p => edge(p, ch === 'L' ? 'E' : 'N', i, nodes.length === 1 ? -1 : component));
    }
    layers.push(nodes.map(p => [...p]));
  }
  return {edges, edgeSet:new Set(edges.map(e => e.key)), layers, width:nodes[0][0], height:nodes[0][1], components:component+1};
}

export function subordinate(w, ambient) {
  if (w.length !== ambient.word.length) return false;
  const d = diagram(w);
  return d.width === ambient.diagram.width && d.height === ambient.diagram.height && d.edges.every(e => ambient.diagram.edgeSet.has(e.key));
}
export const ambientFor = word => ({word, diagram:diagram(word)});
export const codomainComponents = c => [...c.matchAll(/<[01]*>/g)].map((m,index)=>({word:m[0],start:m.index,end:m.index+m[0].length,index}));
export const componentAssignments = (c,f,g) => codomainComponents(c).map(part=>({...part,f:f.slice(part.start,part.end),g:g.slice(part.start,part.end),domainF:prune(f.slice(part.start,part.end)),domainG:prune(g.slice(part.start,part.end))}));

export function validate(cInput, fInput, gInput, aInput = '') {
  const c = parse(cInput, 'c', true), f = parse(fInput, 'f'), g = parse(gInput, 'g');
  if (c.length > 160) throw new Error('Please use a snake den with at most 160 letters for a readable step-by-step diagram.');
  const a = prune(f);
  if (prune(g) !== a) throw new Error(`The domains differ: pruning f gives ${pretty(a) || 'ε'}, while pruning g gives ${pretty(prune(g)) || 'ε'}. Remove L and C to compare domains.`);
  if (aInput.trim() && parse(aInput, 'a') !== a) throw new Error(`The stated domain a must equal the common pruning, ${pretty(a) || 'ε'}.`);
  const ambient = ambientFor(c);
  for (const [name,w] of [['f',f],['g',g]]) {
    if (w.length !== c.length) throw new Error(`${name} has ${w.length} letters; c has ${c.length}. Each slither needs one letter for every letter of c.`);
    if (!subordinate(w, ambient)) throw new Error(`${name} is not subordinate to c: its endpoint or an edge lies outside the ambient snake den. Check L (east) and C (north) and the bracket positions.`);
  }
  return {a,c,f,g,ambient,components:componentAssignments(c,f,g)};
}

function swap(w,i,j) { const s=w.split(''); [s[i],s[j]]=[s[j],s[i]]; return s.join(''); }
const replace2 = (w,i,j,ch) => w.slice(0,i)+ch+w.slice(i+1,j)+ch+w.slice(j+1);
export function moveAt(w, i, j, ambient) {
  const a=w[i], b=w[j];
  if (i >= j || w.slice(i+1,j).split('').some(ch => !bound(ch))) return null;
  const next=swap(w,i,j);
  let rule, kind, witness = null;
  if (j === i+1 && bound(a) && bound(b) && a !== b) {
    // Tongues are in pen mode, outside a component.
    if (w.slice(0,i).lastIndexOf('<') > w.slice(0,i).lastIndexOf('>')) return null;
    rule='Tongue rule'; kind='Tongue flip';
    witness=w.slice(0,i)+'<>'+w.slice(j+1);
  } else if (j === i+1 && ((bound(a) && '<>'.includes(b)) || ('<>'.includes(a) && bound(b)))) {
    rule='Bracket rule'; kind=(a === '<' || b === '<') ? 'Opening slide' : 'Closing slide';
    const bracket='<'.includes(a) || '<'.includes(b) ? '<' : '>';
    const fixed=bound(a)?a:b;
    const pair=bracket === '<' ? '<'+(fixed==='L'?'0':'1') : (fixed==='L'?'0':'1')+'>';
    witness=w.slice(0,i)+pair+w.slice(j+1);
  } else if ((a==='0' && b==='L') || (b==='0' && a==='L') || (a==='1' && b==='C') || (b==='1' && a==='C')) {
    rule='Scale rule'; kind='Scale-boundary slide';
    witness=replace2(w,i,j,a==='0'||a==='1'?a:b);
  } else return null;
  if (!subordinate(next,ambient) || !subordinate(witness,ambient)) return null;
  return {from:w,to:next,i,j,rule,kind,witness};
}

// Facet substitutions, lifted through existing bound positions.
function randomFacet(w, random) {
  const free=[...w].flatMap((ch,i)=>bound(ch)?[]:[i]), choices=[];
  const pairs={'<0':['L<'],'0>':['>L'],'<1':['C<'],'1>':['>C'],'01':['><'],'10':['><'],'<>':['LC','CL']};
  for(let k=0;k<free.length;k++) {
    const i=free[k],j=free[k+1];
    if(w[i]==='0'||w[i]==='1')choices.push([i,i,w[i]==='0'?'L':'C']);
    if(j!==undefined)for(const replacement of pairs[w[i]+w[j]]||[])choices.push([i,j,replacement]);
  }
  if(!choices.length)return w;
  const [i,j,s]=choices[Math.floor(random()*choices.length)];
  return i===j?w.slice(0,i)+s+w.slice(i+1):w.slice(0,i)+s[0]+w.slice(i+1,j)+s[1]+w.slice(j+1);
}

function randomMove(w,ambient,random,avoid) {
  const pairs=[];
  for(let i=0;i<w.length-1;i++)pairs.push([i,i+1]);
  for(let i=0;i<w.length;i++)if(w[i]==='0'||w[i]==='1') {
    const fixed=w[i]==='0'?'L':'C';
    for(const direction of [-1,1])for(let j=i+direction;j>=0&&j<w.length&&bound(w[j]);j+=direction) {
      if(Math.abs(j-i)>1&&w[j]===fixed)pairs.push([Math.min(i,j),Math.max(i,j)]);
    }
  }
  for(let i=pairs.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}
  let fallback=null;
  for(const [i,j] of pairs){const m=moveAt(w,i,j,ambient);if(m){if(m.to!==avoid)return m;fallback=m;}}
  return fallback;
}

export function generatePair(cInput,random=Math.random) {
  const c=parse(cInput,'c',true);
  if(c.length>160)throw new Error('Please use a snake den with at most 160 letters for random generation.');
  if(!c.length)throw new Error('The empty snake den has only the empty slither. There is no distinct random pair; enter a nonempty codomain to generate one.');
  const ambient=ambientFor(c);
  let f=c;
  const depth=1+Math.floor(random()*(c.length-1));
  for(let k=0;k<depth;k++)f=randomFacet(f,random);
  // A face without bound letters may have just one embedding. Reduce further
  // until a move is available; vertices allow square flips in a snake.
  let first=randomMove(f,ambient,random);
  for(let k=0;!first&&k<c.length;k++){f=randomFacet(f,random);first=randomMove(f,ambient,random);}
  if(!first)throw new Error('Could not generate a distinct pair in this codomain.');
  let g=first.to,lastDifferent=g,previous=f;
  const steps=2+Math.floor(random()*Math.min(48,2*c.length));
  for(let k=1;k<steps;k++) {
    const move=randomMove(g,ambient,random,previous);
    if(!move)break;
    previous=g;g=move.to;if(g!==f)lastDifferent=g;
  }
  if(g===f)g=lastDifferent;
  return validate(c,f,g);
}

export function normalize(start, ambient) {
  let w=start;
  const moves=[];
  const apply = m => { if(!m) throw new Error('A required elementary move failed its ambient-snake check.'); moves.push(m); w=m.to; };
  // The position sum strictly decreases after each movable letter is processed.
  for (let guard=0; guard < start.length*start.length+1; guard++) {
    const free=[...w].map((ch,i)=>bound(ch)?-1:i).filter(i=>i>=0);
    let movable=null;
    for (let k=0;k<free.length;k++) {
      const p=free[k], prev=k?free[k-1]:-1, ch=w[p];
      let j=-1;
      if (k===0 && p>0) j=0;
      else if (ch==='0'||ch==='1') { for(let t=prev+1;t<p;t++) if(ambient.word[t]===ch) {j=t;break;} }
      else if (ch==='>' && p>prev+1) j=p-1;
      else if (ch==='<' && k>0) {for(let t=prev+1;t<p;t++) if(ambient.word[t]!==ambient.word[prev]) {j=t;break;} }
      if (j>=0) {movable={p,prev,ch,j};break;}
    }
    if (!movable) return {word:w,moves};
    const {p,prev,ch,j}=movable;
    if(ch==='0'||ch==='1') {apply(moveAt(w,j,p,ambient));continue;}
    let m=moveAt(w,p-1,p,ambient);
    if(m) {apply(m);continue;}
    if(ch!== '<') throw new Error('The required closing slide was unavailable.');
    // Bring the nearest opposite bound step to the opening.
    let q=p-2;
    while(q>prev && w[q]===w[p-1]) q--;
    if(q<=prev) throw new Error('The required tongue preparation was unavailable.');
    for(let t=q;t<p-1;t++) apply(moveAt(w,t,t+1,ambient));
    apply(moveAt(w,p-1,p,ambient));
  }
  throw new Error('Normalization exceeded its termination guard.');
}

function solveSnake(input) {
  const {f,g,ambient}=input;
  if(f===g) return {...input,moves:[],words:[f],leftF:0,leftG:0};
  const nf=normalize(f,ambient), ng=normalize(g,ambient);
  let w=nf.word;
  const bridge=[];
  // Leftmost representatives agree through the last closing bracket. Their
  // remaining lattice paths are connected by adjacent square flips.
  for(let i=0;i<w.length;i++) {
    if(w[i]===ng.word[i]) continue;
    if(!bound(w[i])||!bound(ng.word[i])) throw new Error('The leftmost free-letter positions did not agree.');
    let j=i+1; while(j<w.length&&w[j]!==ng.word[i]) j++;
    if(j===w.length) throw new Error('Leftmost tails have different endpoints.');
    for(let k=j-1;k>=i;k--) {
      const m=moveAt(w,k,k+1,ambient);
      if(!m) throw new Error('A tail square flip left the ambient snake.');
      bridge.push(m);w=m.to;
    }
  }
  const proofMoves=[...nf.moves.map(m=>({...m,phase:'Move f left'})), ...bridge.map(m=>({...m,phase:'Match bound tails'})), ...ng.moves.slice().reverse().map(m=>({...m,from:m.to,to:m.from,phase:'Reverse g’s moves'}))];
  // Erase closed excursions, retaining a certificate for every surviving move.
  const moves=[], words=[f], seen=new Map([[f,0]]);
  for(const m of proofMoves) {
    if(seen.has(m.to)) {
      const back=seen.get(m.to);
      for(let k=back+1;k<words.length;k++) seen.delete(words[k]);
      words.length=back+1; moves.length=back;
    } else {moves.push(m);words.push(m.to);seen.set(m.to,words.length-1);}
  }
  // Completion means equality of the entire word, including every bound letter.
  if(words.at(-1)!==g || moves.some((m,i)=>m.from!==words[i] || m.to!==words[i+1])) {
    throw new Error('The sequence did not reach the full target word, including its L and C letters.');
  }
  return {...input,moves,words,normalF:nf.word,normalG:ng.word,omitted:proofMoves.length-moves.length};
}

export function solve(input) {
  const {c,f,g}=input,components=componentAssignments(c,f,g);
  const incompatible=components.filter(part=>part.domainF!==part.domainG);
  if(incompatible.length) {
    // Every generator and its post-composed witness stays on one side of each
    // mandatory ambient join. Pruning on each c component is an invariant.
    return {...input,components,reachable:false,obstruction:incompatible,moves:[],words:[f]};
  }
  if(components.length<=1)return {...solveSnake(input),components,reachable:true};
  let w=f,normalF='',normalG='',omitted=0;
  const moves=[],words=[f];
  for(const part of components) {
    const local=solveSnake({c:part.word,f:part.f,g:part.g,a:part.domainF,ambient:ambientFor(part.word)});
    for(const m of local.moves) {
      const before=w,prefix=before.slice(0,part.start),suffix=before.slice(part.end);
      w=prefix+m.to+suffix;
      moves.push({...m,from:before,to:w,witness:prefix+m.witness+suffix,i:m.i+part.start,j:m.j+part.start,component:part.index+1});
      words.push(w);
    }
    normalF+=local.normalF??part.f;normalG+=local.normalG??part.g;omitted+=local.omitted??0;
  }
  if(w!==g || moves.some((m,i)=>m.from!==words[i]||m.to!==words[i+1]))throw new Error('The component moves did not reach the full target word.');
  return {...input,components,reachable:true,moves,words,normalF,normalG,omitted};
}
