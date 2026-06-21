const TRIP_KEY = 'anchor_v1';
const CHAT_KEY = 'anchor_chat';

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

// A minimal valid trip so new users land straight in the concierge. The
// concierge fills in hotel/dates/interests through conversation.
export function blankTrip(){
  return {destination:'Tokyo',arrivalDate:'',nights:0,anchors:[],prefs:[],anchoredPlaces:[],taste:{likes:[],dislikes:[]},createdAt:Date.now()};
}

// "Not set up yet" = no hotel anchor and no arrival date.
export function tripNeedsSetup(trip){
  return !trip||(!((trip.anchors||[]).length)&&!trip.arrivalDate);
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
