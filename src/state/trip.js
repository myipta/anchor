const TRIP_KEY = 'anchor_v1';
const CHAT_KEY = 'anchor_chat';
const LIBRARY_VERSION = 2;

export function loadTrip(){
  try{
    return JSON.parse(localStorage.getItem(TRIP_KEY)||'null');
  }catch{
    return null;
  }
}

export function saveTrip(trip){
  localStorage.setItem(TRIP_KEY,JSON.stringify(trip));
}

function tripId(){
  try{ if(crypto&&crypto.randomUUID) return crypto.randomUUID(); }catch{}
  return 'trip-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
}

function clone(value){
  return JSON.parse(JSON.stringify(value||null));
}

// A minimal valid trip so new users land straight in the concierge. The
// concierge fills in hotel/dates/interests through conversation.
export function blankTrip(seed={}){
  const now=Date.now();
  return {
    id:seed.id||tripId(),
    destination:seed.destination||'Tokyo',
    arrivalDate:'',
    nights:0,
    anchors:[],
    prefs:Array.isArray(seed.prefs)?[...seed.prefs]:[],
    anchoredPlaces:[],
    taste:clone(seed.taste)||{likes:[],dislikes:[]},
    createdAt:seed.createdAt||now,
  };
}

export function ensureTrip(trip){
  const t=trip&&typeof trip==='object'?{...trip}:blankTrip();
  if(!t.id) t.id=tripId();
  if(!t.destination) t.destination='Tokyo';
  if(!Array.isArray(t.anchors)) t.anchors=[];
  if(!Array.isArray(t.prefs)) t.prefs=[];
  if(!Array.isArray(t.anchoredPlaces)) t.anchoredPlaces=[];
  if(!t.taste||typeof t.taste!=='object') t.taste={likes:[],dislikes:[]};
  if(!Array.isArray(t.taste.likes)) t.taste.likes=[];
  if(!Array.isArray(t.taste.dislikes)) t.taste.dislikes=[];
  if(!t.createdAt) t.createdAt=Date.now();
  return t;
}

export function isTripLibrary(value){
  return Boolean(value&&typeof value==='object'&&value.version===LIBRARY_VERSION&&Array.isArray(value.trips));
}

export function toTripLibrary(value){
  if(isTripLibrary(value)){
    const trips=value.trips.map(ensureTrip);
    const activeTripId=trips.some(t=>t.id===value.activeTripId)?value.activeTripId:(trips[0]&&trips[0].id);
    return {version:LIBRARY_VERSION,activeTripId,trips,createdAt:value.createdAt||Date.now(),updatedAt:value.updatedAt||0};
  }
  const first=value&&typeof value==='object'?ensureTrip(value):blankTrip();
  return {version:LIBRARY_VERSION,activeTripId:first.id,trips:[first],createdAt:first.createdAt||Date.now(),updatedAt:first.updatedAt||0};
}

export function activeTripFromLibrary(library){
  const lib=toTripLibrary(library);
  return lib.trips.find(t=>t.id===lib.activeTripId)||lib.trips[0]||blankTrip();
}

export function updateActiveTrip(library, trip){
  const lib=toTripLibrary(library);
  const next=ensureTrip({...trip,id:trip?.id||lib.activeTripId});
  const trips=lib.trips.some(t=>t.id===next.id)?lib.trips.map(t=>t.id===next.id?next:t):[...lib.trips,next];
  return {...lib,activeTripId:next.id,trips};
}

export function switchActiveTrip(library, id){
  const lib=toTripLibrary(library);
  return lib.trips.some(t=>t.id===id)?{...lib,activeTripId:id}:lib;
}

export function createTripFrom(library, sourceTrip, attrs={}){
  const lib=toTripLibrary(library);
  const source=ensureTrip(sourceTrip||activeTripFromLibrary(lib));
  const trip=blankTrip({
    destination:attrs.destination||'New trip',
    prefs:Array.isArray(source.prefs)?source.prefs:[],
    taste:source.taste||{likes:[],dislikes:[]},
  });
  const next={...lib,activeTripId:trip.id,trips:[...lib.trips,trip]};
  return next;
}

export function tripTitle(trip){
  const t=ensureTrip(trip);
  const dest=t.destination||'Trip';
  if(t.arrivalDate) return dest + ' · ' + t.arrivalDate;
  if(t.anchors&&t.anchors[0]&&t.anchors[0].name) return dest + ' · ' + t.anchors[0].name;
  return dest;
}

// "Not set up yet" = no hotel anchor and no arrival date.
export function tripNeedsSetup(trip){
  const t=isTripLibrary(trip)?activeTripFromLibrary(trip):trip;
  return !t||(!((t.anchors||[]).length)&&!t.arrivalDate);
}

export function loadChat(){
  try{
    const chat=JSON.parse(localStorage.getItem(CHAT_KEY)||'null');
    return Array.isArray(chat)&&chat.length?chat:null;
  }catch{
    return null;
  }
}

export function saveChat(messages){
  try{
    localStorage.setItem(CHAT_KEY,JSON.stringify((messages||[]).slice(-40)));
  }catch{}
}
