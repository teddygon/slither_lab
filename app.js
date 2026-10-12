import {validate,solve,diagram,pretty,generatePair} from './math.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let result=null,step=0,timer=null,dirty=false;
const lectureExample=['<0111000110>','LC<CC0>LCLCL','<0>CCLCLLCLC'];

function polygonFor(d,color){
  const paths=[];let upper=[],lower=[];
  for(let i=0;i<d.layers.length;i++){
    const layer=d.layers[i];
    if(layer.length===2){
      if(!upper.length){upper.push(d.layers[i-1][0]);lower.push(d.layers[i-1][0]);}
      upper.push(layer[0]);lower.push(layer[1]);
    }else if(upper.length){
      upper.push(layer[0]);lower.push(layer[0]);
      paths.push(`<polygon points="${[...upper,...lower.reverse()].map(p=>`${p[0]},${-p[1]}`).join(' ')}" fill="${color}"/>`);
      upper=[];lower=[];
    }
  }
  return paths.join('');
}

function draw(w,previous,role,highlight=false){
  const d=diagram(w),ad=result.ambient.diagram,pd=diagram(previous),changed=new Set(d.edges.filter(e=>!pd.edgeSet.has(e.key)).map(e=>e.key));
  const W=ad.width,H=ad.height,unit=42,ink=role==='target'?'#915136':'#254e38';
  const edge=(e,color,width,dash='')=>`<line x1="${e.x}" y1="${-e.y}" x2="${e.x+(e.d==='E'?1:0)}" y2="${-e.y-(e.d==='N'?1:0)}" stroke="${color}" stroke-width="${width}" vector-effect="non-scaling-stroke" stroke-linecap="round"${dash?` stroke-dasharray="${dash}"`:''}/>`;
  const inactive=ad.edges.map(e=>edge(e,'#a0aa8b',1.2,'3 4')).join('');
  const active=d.edges.map(e=>edge(e,highlight&&changed.has(e.key)?'#d06534':ink,highlight&&changed.has(e.key)?4:2.8)).join('');
  const joins=result.components.slice(0,-1).map(p=>{const [x,y]=ad.layers[p.end][0];return `<circle cx="${x}" cy="${-y}" r=".13" fill="#fffbed" stroke="#b28a31" stroke-width="1.7" vector-effect="non-scaling-stroke"><title>Join after codomain component ${p.index+1}</title></circle>`;}).join('');
  const size=$('diagram-size').value==='cells'&&role!=='intermediate'?` style="width:${(W+1.8)*unit}px;height:${(H+1.8)*unit}px;max-width:none;flex-shrink:0"`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="0 0 ${(W+1.8)*unit} ${(H+1.8)*unit}" role="img" aria-label="${esc(role+' slither '+(pretty(w)||'ε')+' inside '+(pretty(result.c)||'ε'))}" preserveAspectRatio="xMidYMid meet"><title>${esc(pretty(w)||'ε')}</title><g transform="translate(${.85*unit} ${(H+.7)*unit}) scale(${unit})">${polygonFor(ad,'#e8ecdb')}${polygonFor(d,role==='target'?'#f3e4c9':'#dce9ce')}${inactive}${active}${joins}<circle r=".075" fill="${ink}"/><circle cx="${W}" cy="${-H}" r=".075" fill="${ink}"/></g><g fill="#778269" font-family="ui-monospace,monospace" font-size="12"><text x="${.85*unit}" y="${(H+1.23)*unit}" text-anchor="middle">(0,0)</text>${W||H?`<text x="${(W+.85)*unit}" y="${.3*unit}" text-anchor="middle">(${W},${H})</text>`:''}</g></svg>`;
}

function wordHTML(w,m,highlight){
  if(!w)return '<span class="letter"><span class="char">ε</span></span>';
  const cuts=new Set(result.components.slice(0,-1).map(p=>p.end));
  return [...w].map((ch,i)=>`<span class="letter${highlight&&m&&(i===m.i||i===m.j)?' changed-letter':''}"><span class="char">${esc(pretty(ch))}</span><span class="index">${i+1}</span></span>${cuts.has(i+1)?'<span class="component-gap" title="Codomain component boundary" aria-hidden="true"></span>':''}`).join('');
}

function explain(m){
  const left=m.from[m.i],right=m.from[m.j],positions=`positions ${m.i+1} and ${m.j+1}`;
  if(m.kind==='Tongue flip')return 'L and C exchange places across an ambient square.';
  if(m.kind==='Opening slide')return `The opening bracket slides ${left==='<'?'right':'left'} across a ${left==='L'||right==='L'?'horizontal loop':'vertical coloop'}.`;
  if(m.kind==='Closing slide')return `The closing bracket slides ${left==='>'?'right':'left'} across a ${left==='L'||right==='L'?'horizontal loop':'vertical coloop'}.`;
  const bit=left==='0'||left==='1'?left:right;
  return `${bit} exchanges places with a ${bit==='0'?'loop L':'coloop C'} at ${positions}. ${m.j>m.i+1?'The intervening bound letters stay fixed.':'An internal scale boundary moves.'}`;
}

function renderCertificate(m){
  if(result.reachable===false){
    $('certificate-body').innerHTML='<p>The joins of the ambient snake den are mandatory vertices. Every allowed elementary move, including its ambient witness, stays within a codomain component. The pruning inside each component is therefore invariant. The table below shows where f and g disagree.</p>';return;
  }
  if(!m){$('certificate-body').innerHTML=result.moves.length?'<p>No move has been applied yet. Step forward to inspect the first move and its ambient witness.</p>':'<p>The words already agree, including every L and C. No move is needed.</p>';return;}
  let text;
  if(m.kind==='Tongue flip')text='Replace the exchanged bound letters by ⟨⟩ to obtain the ambient slither h below. Its extra square lets the bound path flip from one side to the other.';
  else if(m.kind==='Scale-boundary slide')text='Replace both exchanged letters by the binary digit to obtain h below. After pruning h, these digits are consecutive. Sliding the boundary between them and restoring the intervening bound letters gives the displayed move.';
  else text='Replace the bracket–bound pair by the corresponding bracket–binary pair to obtain h below. The original and resulting diagrams are its two bracket-slide alternatives.';
  $('certificate-body').innerHTML=`<p>${text}</p><span class="witness-word">h = ${esc(pretty(m.witness)||'ε')}</span><div class="certificate-diagram">${draw(m.witness,m.witness,'intermediate')}</div><p>The diagram of <i>h</i> lies inside <i>c</i>, so the move is available in the chosen codomain. A local move can be used within a larger diagram while preserving the surrounding factors and any inserted bound letters.${m.component?` Here the move is in c${m.component}; the other components stay fixed.`:''} Both endpoint words prune to <strong>${esc(pretty(result.a)||'ε')}</strong>.</p>`;
}

function renderAssignments(){
  $('component-info').hidden=result.components.length<2;
  $('component-summary').textContent=`Codomain components · ${result.components.length} snakes`;
  $('component-info').open=result.reachable===false;
  $('component-table').innerHTML=`<table><thead><tr><th>Component of c</th><th>f prunes to</th><th>g prunes to</th></tr></thead><tbody>${result.components.map(p=>`<tr class="${p.domainF===p.domainG?'':'different-assignment'}"><th>c${p.index+1} = <code>${esc(pretty(p.word))}</code></th><td>${esc(pretty(p.domainF)||'ε')}</td><td>${esc(pretty(p.domainG)||'ε')}</td></tr>`).join('')}</tbody></table>`;
}

function render(){
  if(!result)return;
  const n=result.moves.length,blocked=result.reachable===false,current=result.words[step],m=step>0?result.moves[step-1]:null;
  const complete=!blocked&&step===n;
  if(complete&&current!==result.g)throw new Error('The final word still differs from g.');
  const highlight=$('show-changes').checked&&!!m;
  $('current-state').textContent=complete?'g reached':`State ${step}`;
  $('current-diagram').innerHTML=draw(current,step>0?result.words[step-1]:current,'current',highlight);
  // The target depends only on g: it never changes with the selected step.
  $('target-diagram').innerHTML=draw(result.g,result.g,'target');
  for(const id of ['current-diagram','target-diagram'])$(id).classList.toggle('large-cells',$('diagram-size').value==='cells');
  $('current-word').innerHTML=wordHTML(current,m,highlight);
  $('target-word').innerHTML=wordHTML(result.g,null,false);
  $('join-legend').hidden=result.components.length<2;
  $('move-number').textContent=blocked?'!':complete?'✓':step===0?'f':String(step).padStart(2,'0');
  $('move-title').textContent=blocked?'Different component assignments':complete?'g reached':m?m.kind:'Start at f';
  $('move-rule').textContent=m?m.rule:blocked?'No allowed path':complete?'Complete':'Ready';
  $('move-text').textContent=blocked?'Component domains differ. Allowed moves cannot cross a codomain join.':m?explain(m):'';
  $('move-text').hidden=!$('move-text').textContent;
  $('move-rule').hidden=!m;
  if(m){
    $('local-change').innerHTML=`${esc(pretty(m.from.slice(m.i,m.j+1)))}<span class="change-arrow">→</span>${esc(pretty(m.to.slice(m.i,m.j+1)))}<span class="position-note">positions ${m.i+1}${m.j===m.i+1?'–':' and '}${m.j+1}</span>`;
  }else $('local-change').textContent=blocked?'See the component table below.':`${complete?'g':'f'} = ${pretty(current)||'ε'}`;
  $('step-counter').textContent=blocked?'No move path':`${step} / ${n} moves`;
  $('step-slider').max=String(n);$('step-slider').value=String(step);$('step-slider').disabled=n===0;
  $('step-slider').setAttribute('aria-valuetext',blocked?'No allowed move path':complete?'Complete: the current state equals g':`${step} of ${n} moves applied`);
  $('first').disabled=$('previous').disabled=step===0;
  $('last').disabled=$('next').disabled=blocked||complete;
  $('next').setAttribute('aria-label',step===n-1?'Apply final move':'Apply next move');
  $('play').disabled=n===0||dirty;
  $('result-badge').textContent=dirty?'Previous pair':blocked?'No allowed path':complete?'Target reached':`${n} ${n===1?'move':'moves'}`;
  $('result-badge').classList.toggle('blocked',blocked);
  $('start-label').textContent=pretty(result.f)||'ε';$('end-label').textContent=pretty(result.g)||'ε';
  setPlayLabel();renderCertificate(m);
}

function setPlayLabel(){
  const replay=result&&result.moves.length>0&&step===result.moves.length;
  $('play').innerHTML=timer?'<span aria-hidden="true">Ⅱ</span> Pause':replay?'<span aria-hidden="true">↻</span> Replay':'<span aria-hidden="true">▶</span> Play';
  $('play').setAttribute('aria-label',timer?'Pause sequence':replay?'Replay sequence':'Play sequence');
}
function pause(){if(timer)clearInterval(timer);timer=null;setPlayLabel();}
function setStep(i){pause();step=Math.min(Math.max(0,i),result.moves.length);render();}
function play(){
  if(timer){pause();return;}
  if(!result||result.moves.length===0||dirty)return;
  if(step===result.moves.length)step=0;
  timer=setInterval(()=>{if(step>=result.moves.length){pause();return;}step++;render();if(step===result.moves.length)pause();},Number($('speed').value));
  render();
}
function showError(e){
  $('error').textContent=e.message;$('error').hidden=false;
  dirty=true;$('domain').textContent='—';$('result-badge').textContent=result?'Previous pair':'Check the words';
  $('stale-notice').hidden=!result;$('play').disabled=true;
}
function build(){
  pause();$('error').hidden=true;
  try{
    result=solve(validate($('codomain').value,$('from-word').value,$('to-word').value));
    step=0;dirty=false;$('stale-notice').hidden=true;
    $('domain').textContent=pretty(result.a)||'ε';
    $('route-title').textContent='Moves';
    renderAssignments();render();
  }catch(e){showError(e);}
}

$('slither-form').addEventListener('submit',e=>{e.preventDefault();build();});
for(const id of ['codomain','from-word','to-word'])$(id).addEventListener('input',()=>{dirty=true;pause();$('stale-notice').hidden=false;$('result-badge').textContent='Previous pair';$('domain').textContent='—';$('play').disabled=true;$('error').hidden=true;});
$('lecture-example').addEventListener('click',()=>{const [c,f,g]=lectureExample;$('codomain').value=c;$('from-word').value=f;$('to-word').value=g;build();});
$('random-pair').addEventListener('click',()=>{pause();try{const pair=generatePair($('codomain').value);$('codomain').value=pair.c;$('from-word').value=pair.f;$('to-word').value=pair.g;build();}catch(e){showError(e);}});
$('first').addEventListener('click',()=>setStep(0));$('previous').addEventListener('click',()=>setStep(step-1));$('next').addEventListener('click',()=>setStep(step+1));$('last').addEventListener('click',()=>setStep(result.moves.length));$('play').addEventListener('click',play);
$('step-slider').addEventListener('input',()=>setStep(Number($('step-slider').value)));
$('show-changes').addEventListener('change',render);$('diagram-size').addEventListener('change',render);
$('speed').addEventListener('change',()=>{if(timer){pause();play();}});
document.addEventListener('keydown',e=>{if($('intro-dialog').open||!result||/^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY|A)$/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='ArrowRight'){e.preventDefault();setStep(step+1);}else if(e.key==='ArrowLeft'){e.preventDefault();setStep(step-1);}else if(e.code==='Space'){e.preventDefault();play();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
build();

$('intro-dismiss').addEventListener('click',()=>$('intro-dialog').close());
$('intro-dialog').addEventListener('close',()=>$('play').focus());
$('intro-dialog').showModal();
