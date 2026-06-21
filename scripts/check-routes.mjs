import { readdirSync, readFileSync } from 'node:fs';

const worker = readFileSync('worker.js', 'utf8');
const protectedBlock = worker.slice(worker.indexOf('const PROTECTED'), worker.indexOf('const ROUTES'));
const apiFiles = readdirSync('functions/api')
  .filter(file => file.endsWith('.js') && !file.startsWith('_'))
  .map(file => file.replace(/\.js$/, ''))
  .sort();

const routes = new Set([...worker.matchAll(/[\"'](\/api\/[^\"']+)[\"']\s*:/g)].map(match => match[1]));
const protectedRoutes = new Set([...protectedBlock.matchAll(/[\"'](\/api\/[^\"']+)[\"']/g)].map(match => match[1]));

function routeFor(name) {
  if (name.startsWith('auth-')) return '/api/auth/' + name.slice(5);
  return '/api/' + name;
}

const publicRoutes = new Set(['/api/health', '/api/trip']);
const missing = [];
const missingProtected = [];
for (const name of apiFiles) {
  const route = routeFor(name);
  if (!routes.has(route)) missing.push(name + '.js -> ' + route);
  const isAuth = route.startsWith('/api/auth/');
  if (!isAuth && !publicRoutes.has(route) && !protectedRoutes.has(route)) missingProtected.push(route);
}

if (missing.length || missingProtected.length) {
  if (missing.length) console.error('Missing ROUTES entries:\n' + missing.map(x => '  - ' + x).join('\n'));
  if (missingProtected.length) console.error('Missing PROTECTED entries:\n' + missingProtected.map(x => '  - ' + x).join('\n'));
  process.exit(1);
}
console.log(`route coverage ok (${apiFiles.length} API files)`);
