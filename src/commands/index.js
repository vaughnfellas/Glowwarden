// src/commands/index.js
// ESM, Node 20+
// Collect all command modules that live in THIS folder (./)

import * as decree from './decree.js';
import * as addalt from './addalt.js';
import * as glowwarden from './glowwarden.js';
import * as ids from './ids.js';
import * as perms from './perms.js';
import * as ping from './ping.js';
import * as status from './status.js';
import * as vcStatus from './vc-status.js';
import * as vc from './vc.js';
import * as generateInvite from './generate-invite.js'; // keep only if the file exists

// Build a Map<name, module> for quick lookup by interactionCreate
export const commands = new Map();
[
  decree,
  addalt,
  glowwarden,
  ids,
  perms,
  ping,
  status,
  vcStatus,
  vc,
  generateInvite,
].filter(Boolean).forEach((mod) => {
  // Expecting each module to export: data (SlashCommandBuilder) and execute()
  if (mod?.data?.name && typeof mod.execute === 'function') {
    commands.set(mod.data.name, mod);
  }
});

// Attach to client (so interactionCreate can do client.commands.get(name))
export function loadCommands(client) {
  client.commands = commands;
}

// Optional helper if you later want to deploy “all commands” in one shot:
// export function allCommandJSON() {
//   return [...commands.values()].map((m) => m.data.toJSON());
// }
