// scripts/check-env.js
import fs from 'node:fs';
import path from 'node:path';

const SNOWFLAKE = v => /^\d{17,20}$/.test(String(v || '').trim());
const isBool = v => ['true','false','1','0',''].includes(String(v).toLowerCase());
const isInt  = v => /^-?\d+$/.test(String(v));

const REQUIRED_SNOWFLAKES = [
  'DECREE_CHANNEL_ID',
  'ROLE_LGBTQ', 'ROLE_ALLY',
  'ROLE_BASE_MEMBER', 'ROLE_BASE_OFFICER', 'ROLE_BASE_VETERAN',
  'ROLE_FINAL_MYCE', 'ROLE_FINAL_GALLIES', 'ROLE_FINAL_GCRUS',
  'ROLE_FINAL_BBEAR', 'ROLE_FINAL_RAPO', 'ROLE_FINAL_RALLYLT',
];

const OPTIONAL_NUMBERS = ['MAX_USES','TEMP_VC_DELETE_AFTER','PORT','PUBLIC_ACK'];
const OPTIONAL_BOOLS   = ['CEREMONY_REMOVE_BASE_ON_FINAL'];

const errors = [];

// 1) Duplicate key detection (dev only; Render rarely has a .env file)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const seen = new Map();
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    if (!key) return;
    if (seen.has(key)) {
      const first = seen.get(key);
      errors.push(`Duplicate key in .env: ${key} (first at line ${first+1}, again at line ${i+1})`);
    } else {
      seen.set(key, i);
    }
  });
}

// 2) Presence & format checks (use process.env so it works on Render too)
for (const k of REQUIRED_SNOWFLAKES) {
  const v = process.env[k];
  if (!v) {
    errors.push(`Missing required env: ${k}`);
  } else if (!SNOWFLAKE(v)) {
    errors.push(`Invalid snowflake for ${k}: "${v}"`);
  }
}

for (const k of OPTIONAL_NUMBERS) {
  if (process.env[k] !== undefined && process.env[k] !== '') {
    if (!isInt(process.env[k])) errors.push(`Expected integer for ${k}, got "${process.env[k]}"`);
  }
}

for (const k of OPTIONAL_BOOLS) {
  if (process.env[k] !== undefined && !isBool(process.env[k])) {
    errors.push(`Expected boolean-ish for ${k} (true/false/1/0), got "${process.env[k]}"`);
  }
}

// Discord deploy minimums (makes failures obvious on build)
if (process.argv.includes('--for-deploy')) {
  for (const k of ['DISCORD_TOKEN','CLIENT_ID']) {
    if (!process.env[k]) errors.push(`Missing required env for deploy: ${k}`);
  }
}

if (errors.length) {
  console.error('\n❌ ENV VALIDATION FAILED:\n- ' + errors.join('\n- ') + '\n');
  process.exit(1);
} else {
  console.log('✅ env ok');
}
