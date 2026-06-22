/* ── API CLIENT ── (same-origin Cloudflare Worker; all calls fail soft) */
export const API = {
  async suggest(prefs,places){
    try{
      const r=await fetch('/api/suggest',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({prefs,places:places.map(p=>({id:p.id,name:p.name,area:p.area,cat:p.catLabel||p.cat,digest:p.digest||p.note||p.reason||''}))})});
      if(!r.ok) return null;
      const d=await r.json();
      return Array.isArray(d.ranked)&&d.ranked.length?d.ranked:null;
    }catch{return null;}
  },
  async places(query,area,limit=10){
    try{
      const r=await fetch('/api/places',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({query,area,limit})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',message:d.message,places:[]};
      return {places:Array.isArray(d.places)?d.places:[]};
    }catch{return {error:'network',message:'Could not reach the server.',places:[]};}
  },
  async search(query,area,taste,prefs,limit=14,destination='Tokyo'){
    try{
      const r=await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({query,area,taste,prefs,limit,destination})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',message:d.message,places:[]};
      return {places:Array.isArray(d.places)?d.places:[],source:d.source};
    }catch{return {error:'network',message:'Could not reach the server.',places:[]};}
  },
  async searchChat(messages,taste,prefs,area){
    try{
      const r=await fetch('/api/searchchat',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({messages,taste,prefs,area})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',reply:d.reply||d.message||'Search failed.',places:[]};
      return {action:d.action,reply:d.reply||'',places:Array.isArray(d.places)?d.places:[],source:d.source};
    }catch{return {error:'network',reply:'Could not reach the server — try again in a moment.',places:[]};}
  },
  async concierge(messages,context,model){
    try{
      const r=await fetch('/api/concierge',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({messages,context,model})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',reply:d.reply||d.message||'I had trouble responding — try again.',learned:{likes:[],dislikes:[]},updates:{},chips:[]};
      return {reply:d.reply||'',recommend:!!d.recommend,search:d.search||'',area:d.area||'',learned:d.learned||{likes:[],dislikes:[]},updates:d.updates||{},chips:Array.isArray(d.chips)?d.chips:[]};
    }catch{return {error:'network',reply:'Could not reach me just now — try again in a moment.',learned:{likes:[],dislikes:[]},updates:{},chips:[]};}
  },
  async tabelog(query,area,taste,prefs,saved,excludeNames=[],destination='Tokyo'){
    try{
      const loc=String(destination||'')+' '+String(area||'');
      const isJapan=!/\b(broomfield|denver|colorado|\bco\b|united states|usa|u\.s\.|new york|seattle|san francisco|los angeles|chicago|boston|austin|portland)\b/i.test(loc)&&/\b(tokyo|japan|kyoto|osaka|sapporo|fukuoka|kanazawa|hiroshima|nagoya|yokohama|shinjuku|shibuya|ginza|asakusa|roppongi|harajuku)\b/i.test(loc);
      const endpoint=isJapan?'/api/tabelog':'/api/search';
      const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({query,area,taste,prefs,saved,excludeNames,destination,limit:14})});
      const d=await r.json();
      if(!r.ok) return {places:[],source:null};
      return {places:(Array.isArray(d.places)?d.places:[]).slice(0,5),source:isJapan?(d.source||null):(d.source||'google')};
    }catch{return {places:[],source:null};}
  },
  async near(lat,lng,{radius=1200,type='all',limit=16,q=''}={}){
    try{
      const r=await fetch('/api/near',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({lat,lng,radius,type,limit,q})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',message:d.message,places:[]};
      return {places:Array.isArray(d.places)?d.places:[],center:d.center};
    }catch{return {error:'network',message:'Could not reach the server.',places:[]};}
  },
  async photo(name,area){
    try{
      const r=await fetch('/api/photo?'+new URLSearchParams({name:name||'',area:area||''}));
      if(!r.ok) return null;
      const d=await r.json();
      return d.url||null;
    }catch{return null;}
  },
  async refine(message,prefs,taste,history){
    try{
      const r=await fetch('/api/refine',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({message,prefs,taste,history})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',reply:d.reply||'',add_likes:[],add_dislikes:[]};
      return {reply:d.reply||'',add_likes:d.add_likes||[],add_dislikes:d.add_dislikes||[]};
    }catch{return {error:'network',reply:'',add_likes:[],add_dislikes:[]};}
  },
  async parsePlace(text){
    try{
      const r=await fetch('/api/parse-place',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({text})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',message:d.message};
      return d; // {name, query, area, note, source}
    }catch{return {error:'network'};}
  },
  async intakeEmail(subject,text){
    try{
      const r=await fetch('/api/intake/email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subject,text})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',message:d.message||'Could not import this email.'};
      return d;
    }catch{return {error:'network',message:'Could not reach Anchor.'};}
  },
  async optimize(date,hotelArea,stops){
    try{
      const r=await fetch('/api/optimize',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({date,hotelArea,stops})});
      const d=await r.json();
      if(!r.ok) return {error:d.error||'error',message:d.message};
      return d; // {ordered:[{id,time}], rationale}
    }catch{return {error:'network',message:'Could not reach Anchor.'};}
  },
  // ── Accounts + cloud-saved trip (Cloudflare D1). Cookies ride along same-origin. ──
  // me() → {cloud:false} if backend unconfigured, else {user:{email}|null}.
  async me(){
    try{
      const r=await fetch('/api/auth/me');
      if(r.status===503) return {cloud:false};
      if(r.status===401) return {cloud:true,user:null};
      if(!r.ok) return {cloud:false};
      const d=await r.json(); return {cloud:true,user:d.user||null};
    }catch{return {cloud:false};}
  },
  async requestCode(email){
    try{
      const r=await fetch('/api/auth/request-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});
      const d=await r.json(); return {...d,status:r.status};
    }catch{return {error:'network',message:'Could not reach Anchor.'};}
  },
  async verifyCode(email,code){
    try{
      const r=await fetch('/api/auth/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,code})});
      const d=await r.json(); return {...d,status:r.status};
    }catch{return {error:'network',message:'Could not reach Anchor.'};}
  },
  async logout(){ try{await fetch('/api/auth/logout',{method:'POST'});}catch{} },
  async tripGet(){
    try{ const r=await fetch('/api/trip'); if(!r.ok) return {error:r.status}; return await r.json(); }
    catch{return {error:'network'};}
  },
  async tripPut(data){
    try{ const r=await fetch('/api/trip',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({data})}); return await r.json(); }
    catch{return {error:'network'};}
  },
};
