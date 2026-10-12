// Identity for the prototype: the server owns the user -> role mapping and issues HMAC-signed tokens.
// The client can no longer claim a role; every call is verified. In a pilot this is replaced by Microsoft Entra ID
// (Static Web Apps auth, x-ms-client-principal) and roles come from Entra app roles instead of USERS below.
const crypto = require('crypto');
const { fail } = require('./errors');

// Demo accounts only (synthetic). Role is decided here, never by the caller.
const USERS = {
  'maria.bd': { role: 'requester', name: 'Business owner' },
  'demo.engineer': { role: 'requester', name: 'Engineer' },
  'sec.reviewer': { role: 'security', name: 'Security reviewer' },
  'platform.lead': { role: 'platform', name: 'Platform approver' },
  'compliance.officer': { role: 'compliance', name: 'Compliance officer' },
  'exec.viewer': { role: 'viewer', name: 'Executive view' },
};
const user = (name) => (Object.hasOwn(USERS, name) ? USERS[name] : null); // not USERS[name]: that also finds toString, constructor...
const TTL_MS = 8 * 60 * 60 * 1000; // tokens expire after 8h (revocation by expiry; rotate LAUNCHGATE_SECRET to revoke all)

// Running on Vercel or Azure (Functions / Static Web Apps), not on a laptop or in the test suite. Hosted, missing
// configuration fails closed: nobody can sign in until it is set.
const HOSTED = Boolean(process.env.VERCEL || process.env.WEBSITE_INSTANCE_ID);
const LOCAL_PASSWORD = 'launchgate-demo'; // published in the README, so only ever accepted when not hosted

// Signing secret. Hosted it is required: serverless instances do not share memory, so a per-process secret would make
// tokens signed by one instance fail on the next. Locally a random per-process secret is fine (tokens reset on restart).
let SECRET = process.env.LAUNCHGATE_SECRET;
if (!SECRET && !HOSTED) { SECRET = crypto.randomBytes(32).toString('hex'); console.warn('LAUNCHGATE_SECRET not set: using a random secret; tokens reset on restart.'); }

// Passwords. DEMO_PASSWORDS (JSON { "user": "password" }) gives each account its own, so whoever holds the requester
// password cannot also sign in as an approver and get past separation of duties. DEMO_PASSWORD covers accounts not listed.
let PASSWORDS = {};
try { PASSWORDS = JSON.parse(process.env.DEMO_PASSWORDS || '{}'); } catch { console.error('DEMO_PASSWORDS is not valid JSON; ignoring it.'); }
const passwordFor = (name) => (typeof PASSWORDS[name] === 'string' && PASSWORDS[name]) || process.env.DEMO_PASSWORD || (HOSTED ? null : LOCAL_PASSWORD);
const CONFIGURED = Boolean(SECRET) && Object.keys(USERS).some(passwordFor);
if (!CONFIGURED) console.error('Sign-in disabled: set LAUNCHGATE_SECRET and DEMO_PASSWORD (or DEMO_PASSWORDS) in the app settings.');
const notConfigured = () => fail(503, 'sign-in is not configured on this server');

// Failed sign-ins per account, per process: after MAX_FAILS within WINDOW_MS the account is locked until the window ends.
// Serverless instances count separately, so this slows guessing rather than stopping it; Entra ID replaces it in a pilot.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
// Constant-time compare. Hashing first gives equal-length buffers for any input (including non-ASCII, where character and
// byte lengths differ), so timingSafeEqual cannot throw and the length of the secret is not leaked.
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function login(username, password) {
  if (!CONFIGURED) throw notConfigured();
  const u = user(username);
  const f = u && fails.get(username);
  const live = f && Date.now() - f.since < WINDOW_MS;
  if (live && f.count >= MAX_FAILS) throw fail(429, 'too many failed sign-ins; try again later'); // even with the right password
  const expected = u && passwordFor(username);
  if (!expected || typeof password !== 'string' || !same(password, expected)) {
    if (u) fails.set(username, live ? { ...f, count: f.count + 1 } : { count: 1, since: Date.now() });
    throw fail(401, 'invalid username or password'); // same message either way: do not reveal which users exist
  }
  fails.delete(username);
  const payload = b64(JSON.stringify({ sub: username, role: u.role, exp: Date.now() + TTL_MS }));
  return { token: `${payload}.${sign(payload)}`, user: username, role: u.role, name: u.name };
}

// Returns { user, role } or throws 401. The role is re-read from USERS so a role change takes effect immediately.
function verify(authorization) {
  if (!CONFIGURED) throw notConfigured();
  const token = String(authorization || '').replace(/^Bearer\s+/i, '');
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw fail(401, 'sign in required');
  if (!same(sig, sign(payload))) throw fail(401, 'invalid token');
  let claims; try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw fail(401, 'invalid token'); }
  if (!claims.exp || claims.exp < Date.now()) throw fail(401, 'token expired');
  const u = user(claims.sub);
  if (!u) throw fail(401, 'account disabled');
  return { user: claims.sub, role: u.role };
}
module.exports = { login, verify, USERS };
