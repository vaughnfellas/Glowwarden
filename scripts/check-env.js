// scripts/check-env.js
import fs from 'node:fs';
import path from 'node:path';

const SNOWFLAKE = v => /^\d{17,20}$/.test(String(v || '').trim());
const isBool = v => ['true','false','1','0',''].includes(String(v).toLowerCase());
const isInt  = v => /^-?\d+$/.test(String(v));

// Core required environment variables (excluding channels which are now in channels.js)
const REQUIRED_ENVS = [
  'DISCORD_TOKEN',
  'CLIENT_ID',
];

// Required role snowflakes
const REQUIRED_SNOWFLAKES = [
  'ROLE_LGBTQ', 
  'ROLE_ALLY',
  'ROLE_BASE_MEMBER', 
  'ROLE_BASE_OFFICER', 
  'ROLE_BASE_VETERAN',
  'ROLE_FINAL_MYCE', 
  'ROLE_FINAL_GALLIES', 
  'ROLE_FINAL_GCRUS',
  'ROLE_FINAL_BBEAR', 
  'ROLE_FINAL_RAPO', 
  'ROLE_FINAL_RALLYLT',
];

// Optional snowflakes (roles/IDs that can be empty)
const OPTIONAL_SNOWFLAKES = [
  'GUILD_ID',
  'TEMP_HOST_ROLE_ID',
  'STRAY_SPORE_ROLE_ID',
  'INVITE_DEFAULT_ROLE_ID',
];

const OPTIONAL_NUMBERS = [
  'MAX_USES',
  'DEFAULT_USES',
  'TEMP_VC_DELETE_AFTER',
  'TEMP_VC_USER_LIMIT',
  'SWEEP_INTERVAL_SEC',
  'PORT',
  'PUBLIC_ACK'
];

const OPTIONAL_BOOLS = [
  'CEREMONY_REMOVE_BASE_ON_FINAL'
];

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

// 2) Required string environment variables
for (const k of REQUIRED_ENVS) {
  const v = process.env[k];
  if (!v || v.trim() === '') {
    errors.push(`Missing required env: ${k}`);
  }
}

// 3) Required snowflake validation
for (const k of REQUIRED_SNOWFLAKES) {
  const v = process.env[k];
  if (!v || v.trim() === '') {
    errors.push(`Missing required role: ${k}`);
  } else if (!SNOWFLAKE(v)) {
    errors.push(`Invalid snowflake for ${k}: "${v}"`);
  }
}

// 4) Optional snowflake validation (only if present)
for (const k of OPTIONAL_SNOWFLAKES) {
  const v = process.env[k];
  if (v && v.trim() !== '' && !SNOWFLAKE(v)) {
    errors.push(`Invalid snowflake for ${k}: "${v}"`);
  }
}

// 5) Number validation
for (const k of OPTIONAL_NUMBERS) {
  if (process.env[k] !== undefined && process.env[k] !== '') {
    if (!isInt(process.env[k])) {
      errors.push(`Expected integer for ${k}, got "${process.env[k]}"`);
    }
  }
}

// 6) Boolean validation
for (const k of OPTIONAL_BOOLS) {
  if (process.env[k] !== undefined && !isBool(process.env[k])) {
    errors.push(`Expected boolean-ish for ${k} (true/false/1/0), got "${process.env[k]}"`);
  }
}

// 7) Validate INVITE_ROLE_MAP format if present
if (process.env.INVITE_ROLE_MAP) {
  const mapStr = process.env.INVITE_ROLE_MAP;
  try {
    for (const pair of mapStr.split(',').map(x => x.trim()).filter(Boolean)) {
      const [code, role] = pair.split(':').map(x => x.trim());
      if (!code) {
        errors.push(`INVITE_ROLE_MAP: empty code in pair "${pair}"`);
      } else if (!role || !SNOWFLAKE(role)) {
        errors.push(`INVITE_ROLE_MAP: invalid role ID in pair "${pair}"`);
      }
    }
  } catch (e) {
    errors.push(`INVITE_ROLE_MAP: malformed format "${mapStr}"`);
  }
}

// 8) Discord deploy minimums (makes failures obvious on build)
if (process.argv.includes('--for-deploy')) {
  for (const k of ['DISCORD_TOKEN','CLIENT_ID']) {
    if (!process.env[k]) errors.push(`Missing required env for deploy: ${k}`);
  }
}

// 9) Channel validation (check channels.js exists and is valid)
try {
  const channelsPath = path.resolve(process.cwd(), 'src/channels.js');
  if (!fs.existsSync(channelsPath)) {
    errors.push('Missing channels.js file at src/channels.js');
  } else {
    // Basic validation that channels.js exports CHANNELS
    const channelsContent = fs.readFileSync(channelsPath, 'utf8');
    if (!channelsContent.includes('export const CHANNELS')) {
      errors.push('channels.js must export CHANNELS object');
    }
    
    // Check for required channel exports
    const requiredChannels = [
      'CHAMBER_OF_OATHS',
      'HALL_OF_RECORDS',
      'RENT_A_WAR_CHAMBER',
      'BATTLEFRONT'
    ];
    
    for (const channel of requiredChannels) {
      if (!channelsContent.includes(channel)) {
        errors.push(`Missing required channel in channels.js: ${channel}`);
      }
    }
  }
} catch (e) {
  errors.push(`Error validating channels.js: ${e.message}`);
}

if (errors.length) {
  console.error('\n❌ ENV VALIDATION FAILED:\n- ' + errors.join('\n- ') + '\n');
  process.exit(1);
} else {
  console.log('✅ env ok');
}