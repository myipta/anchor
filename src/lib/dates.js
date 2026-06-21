export function addDays(d,n){
  const dt=new Date(d+'T00:00:00');
  dt.setDate(dt.getDate()+n);
  return dt.toISOString().slice(0,10);
}

export function daysBetween(from,to){
  return Math.round((new Date(to+'T00:00:00')-new Date(from+'T00:00:00'))/86400000);
}

export function todayStr(){
  return new Date().toISOString().slice(0,10);
}

export function fmtDate(d){
  return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

export function fmtDateLong(d){
  return new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}

export function fmtMonthYear(d){
  return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
