const SUPABASE_URL="https://npovzdaxuvxeqgdougqh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_I4EkQQuOkGmXAf7Mb1wWKw_xSx-HM6p";
const supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let currentUser=null,currentLeader=null,actions=[],entries=[];

$("showLogin").onclick=()=>{ $("loginForm").classList.remove("hidden"); $("signupForm").classList.add("hidden"); $("showLogin").classList.remove("secondary"); $("showSignup").classList.add("secondary"); };
$("showSignup").onclick=()=>{ $("signupForm").classList.remove("hidden"); $("loginForm").classList.add("hidden"); $("showSignup").classList.remove("secondary"); $("showLogin").classList.add("secondary"); };

$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault(); $("loginError").textContent="";
 const {error}=await supabase.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
 if(error) $("loginError").textContent=error.message;
});
$("signupForm").addEventListener("submit",async e=>{
 e.preventDefault(); $("signupError").textContent="";
 const email=$("signupEmail").value.trim(),password=$("signupPassword").value;
 const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
 if(error){$("signupError").textContent=error.message;return}
 if(data.session){currentUser=data.session.user;await loadApp();}
 else $("signupError").textContent="Account created. Check your email to confirm it, then sign in here. Your account will wait for administrator assignment.";
});
$("logoutBtn").onclick=async()=>{await supabase.auth.signOut();showAuth()};
$("refreshBtn").onclick=loadLeaderView;
$("adminRefresh").onclick=loadAdmin;
$("closeModal").onclick=()=>$("entryModal").classList.add("hidden");
$("entryForm").addEventListener("submit",saveEntry);
supabase.auth.onAuthStateChange((_e,s)=>{if(s?.user){currentUser=s.user;loadApp()}else showAuth()});
init();

async function init(){const {data}=await supabase.auth.getSession();if(data.session?.user){currentUser=data.session.user;await loadApp()}else showAuth()}

async function loadApp(){
 $("authView").classList.add("hidden");$("appView").classList.remove("hidden");
 $("userLabel").textContent=currentUser.email||"";
 const {data:leader,error}=await supabase.from("leaders").select("*").eq("user_id",currentUser.id).maybeSingle();
 if(error){showMessage("Could not load your profile: "+error.message);return}
 currentLeader=leader;
 $("waitingView").classList.add("hidden");$("leaderView").classList.add("hidden");$("adminView").classList.add("hidden");
 if(!leader){$("waitingView").classList.remove("hidden");showMessage("Your account is registered. You are waiting for the administrator to assign your department.");return}
 $("userLabel").textContent=leader.name+" • "+leader.role.toUpperCase();
 if(leader.role==="admin"){ $("adminView").classList.remove("hidden"); await loadAdmin(); return; }
 $("leaderView").classList.remove("hidden"); await loadLeaderView();
}

async function loadLeaderView(){
 if(!currentLeader)return;
 const {data:a,error:ae}=await supabase.from("actions").select("*").order("id");
 if(ae){showMessage(ae.message);return} actions=a||[];
 const {data:en,error:ee}=await supabase.from("entries").select("id,action_id,done_on,note,created_at").eq("leader_id",currentLeader.id).order("done_on",{ascending:false});
 if(ee){showMessage(ee.message);return} entries=en||[];renderActions();
}

function renderActions(){
 const relevant=actions.filter(a=>currentLeader.role==="admin"||(currentLeader.role==="hoi"?a.hoi_q:a.hod_q));
 const ids=new Set(entries.map(e=>e.action_id)),done=relevant.filter(a=>ids.has(a.id)).length;
 $("totalActions").textContent=relevant.length;$("completedActions").textContent=done;$("progress").textContent=relevant.length?Math.round(done/relevant.length*100)+"%":"0%";
 $("actionsList").innerHTML=relevant.map(a=>{
  const e=entries.find(x=>x.action_id===a.id);
  return '<div class="action"><div class="action-main"><span class="domain">'+esc(a.domain)+'</span><h3>'+esc(currentLeader.lang==="ar"&&a.name_ar?a.name_ar:a.name_en)+'</h3><p class="evidence">'+esc(a.evidence||"Evidence to be recorded.")+'</p>'+(e?'<div class="done">✓ Completed '+esc(e.done_on)+(e.note?" — "+esc(e.note):"")+"</div>":"")+'</div><button onclick="openModal('+a.id+')">'+(e?"Add another record":"Record evidence")+"</button></div>";
 }).join("");
}
window.openModal=id=>{const a=actions.find(x=>x.id===id);$("modalActionId").value=id;$("modalTitle").textContent=a?(currentLeader.lang==="ar"&&a.name_ar?a.name_ar:a.name_en):"Record evidence";$("doneOn").value=new Date().toISOString().slice(0,10);$("note").value="";$("entryError").textContent="";$("entryModal").classList.remove("hidden")};
async function saveEntry(e){e.preventDefault();const {error}=await supabase.from("entries").insert({leader_id:currentLeader.id,action_id:Number($("modalActionId").value),done_on:$("doneOn").value,note:$("note").value.trim()||null});if(error){$("entryError").textContent=error.message;return}$("entryModal").classList.add("hidden");await loadLeaderView()}

async function loadAdmin(){
 if(!currentLeader||currentLeader.role!=="admin")return;
 const [{data:requests,error:re},{data:leaders,error:le}]=await Promise.all([
  supabase.from("signup_requests").select("user_id,email,created_at,assigned_leader_id").order("created_at",{ascending:false}),
  supabase.from("leaders").select("id,name,role,user_id,email,active").order("name")
 ]);
 if(re){$("adminTable").textContent=re.message;return} if(le){$("adminTable").textContent=le.message;return}
 const assigned=new Map((leaders||[]).filter(x=>x.user_id).map(x=>[x.user_id,x]));
 $("adminTable").innerHTML=(requests||[]).map(r=>{
  const current=assigned.get(r.user_id);
  const opts=(leaders||[]).filter(l=>l.role!=="admin").map(l=>'<option value="'+l.id+'" '+(current&&current.id===l.id?"selected":"")+'>'+esc(l.name)+'</option>').join("");
  return '<div class="admin-row"><div><b>'+esc(r.email)+'</b><div class="muted">'+(current?"Assigned: "+esc(current.name):"Waiting for assignment")+'</div></div><div class="admin-controls"><select id="sel-'+r.user_id+'"><option value="">Not assigned</option>'+opts+'</select><button onclick="assignUser(''+r.user_id+'')">Save</button></div></div>';
 }).join("")||'<p class="muted">No signup requests yet.</p>';
}

window.assignUser=async userId=>{
 const leaderId=$("sel-"+userId).value;
 if(!leaderId){
  const {error}=await supabase.from("leaders").update({user_id:null}).eq("user_id",userId);
  if(error){alert(error.message);return}
  await supabase.from("signup_requests").update({assigned_leader_id:null}).eq("user_id",userId);
 }else{
  const {data:old}=await supabase.from("leaders").select("id").eq("user_id",userId).maybeSingle();
  if(old){await supabase.from("leaders").update({user_id:null}).eq("id",old.id)}
  const {data:target,error}=await supabase.from("leaders").select("id").eq("id",leaderId).single();
  if(error){alert(error.message);return}
  const {error:ue}=await supabase.from("leaders").update({user_id:userId}).eq("id",target.id);
  if(ue){alert(ue.message);return}
  const {error:re}=await supabase.from("signup_requests").update({assigned_leader_id:target.id}).eq("user_id",userId);
  if(re){alert(re.message);return}
 }
 await loadAdmin();
};

function showAuth(){$("appView").classList.add("hidden");$("authView").classList.remove("hidden");$("password").value="";$("showLogin").click()}
function showMessage(t){$("message").textContent=t;$("message").classList.remove("hidden")}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}