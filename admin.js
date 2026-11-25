import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';

const SUPABASE_URL = 'https://xocizxszrqiexfxculsa.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kkoFxldELeXQCUXTYpr_Qg_mejrPEyD';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { user:null, projects:[], inbox:[], announcements:[], settings:{}, activity:[], editing:null };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value ? new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : '—';
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function errorText(error){return error?.message || 'Something went wrong. Please try again.'}
function adminRole(user){return user?.app_metadata?.role === 'admin'}

async function logAction(action, details={}) {
  if (!state.user) return;
  const {error}=await supabase.from('nxt_activity_logs').insert({actor_id:state.user.id,action,details});
  if(error) console.warn('Activity log could not be saved:',error.message);
}
function showLogin(message=''){
  $('#login-screen').classList.remove('hidden');$('#app').classList.add('hidden');$('#login-error').textContent=message;
}
function showApp(){
  $('#login-screen').classList.add('hidden');$('#app').classList.remove('hidden');
  $('#admin-email').textContent=state.user.email || 'Admin';
  $('#today').textContent=new Date().toLocaleDateString([], {day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
}
async function verifySession(session){
  if(!session?.user){state.user=null;showLogin();return false}
  const {data,error}=await supabase.auth.getUser();
  if(error || !data.user || !adminRole(data.user)){
    await supabase.auth.signOut();
    state.user=null;
    showLogin('This account is not authorized as an NXT TEAM administrator.');
    return false;
  }
  state.user=data.user;showApp();await refreshAll();return true;
}
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('button[type=submit]',e.currentTarget);
  button.disabled=true;button.querySelector('span').textContent='VERIFYING…';
  $('#login-error').textContent='';
  const {data,error}=await supabase.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
  button.disabled=false;button.querySelector('span').textContent='AUTHENTICATE';
  if(error){$('#login-error').textContent='Sign-in failed. Check your credentials and try again.';return}
  await verifySession(data.session);
});
$('#logout').addEventListener('click',async()=>{await logAction('Signed out');await supabase.auth.signOut();state.user=null;showLogin('You have signed out.')});
supabase.auth.onAuthStateChange((_event,session)=>{if(!session)showLogin()});
const {data:{session}}=await supabase.auth.getSession();
if(session) await verifySession(session); else showLogin();

async function fetchRows(table,order='created_at',ascending=false){
  const {data,error}=await supabase.from(table).select('*').order(order,{ascending});
  if(error) throw error;return data||[];
}
async function refreshAll(){
  try{
    const [projects,inbox,announcements,activity,settings]=await Promise.all([
      fetchRows('nxt_projects','created_at'),fetchRows('nxt_collab_requests','created_at'),
      fetchRows('nxt_announcements','created_at'),fetchRows('nxt_activity_logs','created_at'),
      supabase.from('nxt_site_settings').select('*')
    ]);
    if(settings.error)throw settings.error;
    state.projects=projects;state.inbox=inbox;state.announcements=announcements;state.activity=activity;
    state.settings=Object.fromEntries((settings.data||[]).map(x=>[x.key,x.value]));
    renderAll();
  }catch(error){toast('Database setup needed: '+errorText(error));console.error(error)}
}
function renderAll(){
  $('#stat-projects').textContent=state.projects.length;
  $('#stat-published').textContent=state.projects.filter(x=>x.status==='published').length;
  $('#stat-inbox').textContent=state.inbox.filter(x=>x.status==='new').length;
  $('#stat-announcements').textContent=state.announcements.filter(x=>x.active).length;
  $('#inbox-count').textContent=state.inbox.filter(x=>x.status==='new').length;
  renderProjects();renderInbox();renderAnnouncements();renderActivity();
  const recent=state.activity.slice(0,5);
  $('#recent-activity').innerHTML=recent.length?recent.map(a=>'<div class="activity-row"><span class="activity-dot"></span><div><b>'+escapeHTML(a.action)+'</b><small>'+escapeHTML(JSON.stringify(a.details||{}))+'</small></div><time>'+escapeHTML(date(a.created_at))+'</time></div>').join(''):'<div class="empty">No activity yet. Changes will appear here.</div>';
  const form=$('#settings-form');for(const key of ['announcement','status_label','contact_email'])form.elements[key].value=(typeof state.settings[key] === 'string' ? state.settings[key] : state.settings[key]?.value) || '';
}
function renderProjects(){
  const q=$('#project-filter').value.toLowerCase(),status=$('#project-status-filter').value;
  const rows=state.projects.filter(p=>(!status||p.status===status)&&[p.title,p.description,p.category].join(' ').toLowerCase().includes(q));
  $('#projects-table').innerHTML=rows.length?'<table class="table"><thead><tr><th>PROJECT</th><th>CATEGORY</th><th>STATUS</th><th>FEATURED</th><th>ACTIONS</th></tr></thead><tbody>'+rows.map(p=>'<tr><td><strong>'+escapeHTML(p.title)+'</strong><br><span class="muted">'+escapeHTML(p.url||'No live URL')+'</span></td><td>'+escapeHTML(p.category)+'</td><td><span class="status '+escapeHTML(p.status)+'">'+escapeHTML(p.status)+'</span></td><td>'+(p.featured?'YES':'—')+'</td><td><div class="table-actions"><button class="small-btn" data-edit-project="'+p.id+'">EDIT</button><button class="small-btn" data-delete-project="'+p.id+'">DELETE</button></div></td></tr>').join('')+'</tbody></table>':'<div class="empty">No projects found. Add your first project.</div>';
}
function renderInbox(){
  const q=$('#inbox-filter').value.toLowerCase(),status=$('#inbox-status-filter').value;
  const rows=state.inbox.filter(r=>(!status||r.status===status)&&[r.name,r.email,r.message,r.collaboration_type].join(' ').toLowerCase().includes(q));
  $('#inbox-list').innerHTML=rows.length?rows.map(r=>'<article class="request-card"><div class="request-top"><div><h3>'+escapeHTML(r.name)+'</h3><div class="request-meta">'+escapeHTML(r.email)+' · '+escapeHTML(r.collaboration_type)+' · '+escapeHTML(date(r.created_at))+'</div></div><span class="status '+escapeHTML(r.status)+'">'+escapeHTML(r.status)+'</span></div><p>'+escapeHTML(r.message)+'</p><div class="request-actions"><button class="small-btn" data-request-status="reviewing" data-id="'+r.id+'">REVIEWING</button><button class="small-btn" data-request-status="accepted" data-id="'+r.id+'">ACCEPT</button><button class="small-btn" data-request-status="declined" data-id="'+r.id+'">DECLINE</button><a class="small-btn" href="mailto:'+encodeURIComponent(r.email)+'?subject='+encodeURIComponent('NXT TEAM collaboration')+'">EMAIL ↗</a></div></article>').join(''):'<div class="empty">Your collaboration inbox is clear.</div>';
}
function renderAnnouncements(){
  $('#announcement-list').innerHTML=state.announcements.length?state.announcements.map(a=>'<article class="announcement-card"><div><div class="announcement-top"><h3>'+escapeHTML(a.title)+'</h3><span class="status '+(a.active?'published':'archived')+'">'+(a.active?'ACTIVE':'HIDDEN')+'</span></div><p>'+escapeHTML(a.body)+'</p><small class="muted">'+escapeHTML(date(a.created_at))+'</small></div><div class="table-actions"><button class="small-btn" data-toggle-announcement="'+a.id+'">'+(a.active?'HIDE':'PUBLISH')+'</button><button class="small-btn" data-edit-announcement="'+a.id+'">EDIT</button><button class="small-btn" data-delete-announcement="'+a.id+'">DELETE</button></div></article>').join(''):'<div class="empty">No announcements yet.</div>';
}
function renderActivity(){
  $('#activity-table').innerHTML=state.activity.length?'<table class="table"><thead><tr><th>EVENT</th><th>DETAILS</th><th>TIME</th></tr></thead><tbody>'+state.activity.map(a=>'<tr><td><strong>'+escapeHTML(a.action)+'</strong></td><td>'+escapeHTML(JSON.stringify(a.details||{}))+'</td><td>'+escapeHTML(date(a.created_at))+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No logged activity yet.</div>';
}
function switchView(view){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const title=$('.nav-item[data-view="'+view+'"]')?.textContent.trim().replace(/[0-9]/g,'').trim()||'Overview';
  $('#page-title').textContent=title;$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});
}
$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)switchView(b.dataset.view)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-jump]');if(b)switchView(b.dataset.jump)});
$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#project-filter').addEventListener('input',renderProjects);$('#project-status-filter').addEventListener('change',renderProjects);
$('#inbox-filter').addEventListener('input',renderInbox);$('#inbox-status-filter').addEventListener('change',renderInbox);

function openModal(title,kicker,fields,record=null,save){
  state.editing={record,save};$('#modal-title').textContent=title;$('#modal-kicker').textContent=kicker;$('#modal-error').textContent='';
  $('#modal-fields').innerHTML=fields.map(f=>{
    const val=record?.[f.name]??f.value??'';
    if(f.type==='select')return '<label class="field-label">'+f.label+'</label><select class="field-input" name="'+f.name+'">'+f.options.map(o=>'<option value="'+escapeHTML(o)+'" '+(val===o?'selected':'')+'>'+escapeHTML(o)+'</option>').join('')+'</select>';
    if(f.type==='checkbox')return '<label class="field-label"><input type="checkbox" name="'+f.name+'" '+(val?'checked':'')+'> '+f.label+'</label>';
    if(f.type==='textarea')return '<label class="field-label">'+f.label+'</label><textarea class="field-input" name="'+f.name+'" '+(f.required?'required':'')+'>'+escapeHTML(val)+'</textarea>';
    return '<label class="field-label">'+f.label+'</label><input class="field-input" name="'+f.name+'" type="'+(f.type||'text')+'" value="'+escapeHTML(val)+'" '+(f.required?'required':'')+' maxlength="'+(f.max||500)+'">';
  }).join('');
  $('#modal').classList.remove('hidden');
}
function closeModal(){$('#modal').classList.add('hidden');state.editing=null}
$('#modal-close').onclick=closeModal;$('#modal-cancel').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
$('#modal-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!state.editing)return;
  const form=new FormData(e.currentTarget),record={};
  for(const [key,value] of form.entries())record[key]=value;
  $$('input[type=checkbox]',e.currentTarget).forEach(x=>record[x.name]=x.checked);
  const button=$('button[type=submit]',e.currentTarget);button.disabled=true;
  try{await state.editing.save(record);closeModal();await refreshAll();toast('Saved successfully.')}
  catch(error){$('#modal-error').textContent=errorText(error)}
  finally{button.disabled=false}
});
$('#new-project').onclick=()=>openModal('Add project','PROJECT VAULT',[{name:'title',label:'PROJECT NAME',required:true},{name:'description',label:'DESCRIPTION',type:'textarea'},{name:'category',label:'CATEGORY',value:'Web'},{name:'url',label:'LIVE URL',type:'url'},{name:'source_url',label:'SOURCE CODE URL',type:'url'},{name:'status',label:'STATUS',type:'select',options:['draft','published','archived'],value:'draft'},{name:'featured',label:'FEATURED',type:'checkbox'}],null,async r=>{const {error}=await supabase.from('nxt_projects').insert(r);if(error)throw error;await logAction('Created project',{title:r.title})});
$('#projects-table').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit-project]'),del=e.target.closest('[data-delete-project]');
 if(edit){const p=state.projects.find(x=>x.id===edit.dataset.editProject);if(!p)return;openModal('Edit project','PROJECT VAULT',[{name:'title',label:'PROJECT NAME',required:true},{name:'description',label:'DESCRIPTION',type:'textarea'},{name:'category',label:'CATEGORY'},{name:'url',label:'LIVE URL',type:'url'},{name:'source_url',label:'SOURCE CODE URL',type:'url'},{name:'status',label:'STATUS',type:'select',options:['draft','published','archived']},{name:'featured',label:'FEATURED',type:'checkbox'}],p,async r=>{const {error}=await supabase.from('nxt_projects').update({...r,updated_at:new Date().toISOString()}).eq('id',p.id);if(error)throw error;await logAction('Updated project',{title:r.title})})}
 if(del){const p=state.projects.find(x=>x.id===del.dataset.deleteProject);if(!p||!confirm('Delete '+p.title+'? This cannot be undone.'))return;const {error}=await supabase.from('nxt_projects').delete().eq('id',p.id);if(error)toast(errorText(error));else{await logAction('Deleted project',{title:p.title});await refreshAll();toast('Project deleted.')}}
});
$('#new-announcement').onclick=()=>openModal('New announcement','PUBLIC BROADCAST',[{name:'title',label:'TITLE',required:true},{name:'body',label:'MESSAGE',type:'textarea',required:true},{name:'active',label:'PUBLISH IMMEDIATELY',type:'checkbox'}],null,async r=>{const {error}=await supabase.from('nxt_announcements').insert(r);if(error)throw error;await logAction('Created announcement',{title:r.title})});
$('#announcement-list').addEventListener('click',async e=>{
 const toggle=e.target.closest('[data-toggle-announcement]'),edit=e.target.closest('[data-edit-announcement]'),del=e.target.closest('[data-delete-announcement]');
 if(toggle){const a=state.announcements.find(x=>x.id===toggle.dataset.toggleAnnouncement);const {error}=await supabase.from('nxt_announcements').update({active:!a.active,updated_at:new Date().toISOString()}).eq('id',a.id);if(error)toast(errorText(error));else{await logAction(a.active?'Hid announcement':'Published announcement',{title:a.title});await refreshAll()}}
 if(edit){const a=state.announcements.find(x=>x.id===edit.dataset.editAnnouncement);openModal('Edit announcement','PUBLIC BROADCAST',[{name:'title',label:'TITLE',required:true},{name:'body',label:'MESSAGE',type:'textarea',required:true},{name:'active',label:'ACTIVE',type:'checkbox'}],a,async r=>{const {error}=await supabase.from('nxt_announcements').update({...r,updated_at:new Date().toISOString()}).eq('id',a.id);if(error)throw error;await logAction('Updated announcement',{title:r.title})})}
 if(del){const a=state.announcements.find(x=>x.id===del.dataset.deleteAnnouncement);if(!confirm('Delete this announcement?'))return;const {error}=await supabase.from('nxt_announcements').delete().eq('id',a.id);if(error)toast(errorText(error));else{await logAction('Deleted announcement',{title:a.title});await refreshAll()}}
});
$('#inbox-list').addEventListener('click',async e=>{
 const b=e.target.closest('[data-request-status]');if(!b)return;
 const row=state.inbox.find(x=>x.id===b.dataset.id);const {error}=await supabase.from('nxt_collab_requests').update({status:b.dataset.requestStatus}).eq('id',row.id);
 if(error)toast(errorText(error));else{await logAction('Updated collaboration request',{name:row.name,status:b.dataset.requestStatus});await refreshAll();toast('Request status updated.')}
});
$('#settings-form').addEventListener('submit',async e=>{
 e.preventDefault();const fd=new FormData(e.currentTarget);
 try{for(const key of ['announcement','status_label','contact_email']){const value=fd.get(key).trim();const {error}=await supabase.from('nxt_site_settings').upsert({key,value:value,updated_at:new Date().toISOString()});if(error)throw error}
 await logAction('Updated site settings');await refreshAll();$('#settings-status').textContent='Settings saved.';toast('Settings saved.')}
 catch(error){$('#settings-status').textContent=errorText(error)}
});
