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
import * as generateInvite from './generate-invite.js';

// Build a Map<name, module> for quick lookup by interactionCreate
export const commands = new Map();

// Array of all command modules
const commandModules = [
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
];

// Register each command module
commandModules.forEach((mod) => {
  // Check if module has valid data and execute function
  if (mod?.data?.name && typeof mod.execute === 'function') {
    commands.set(mod.data.name, mod);
    console.log(`Registered command: ${mod.data.name}`);
  } else {
    console.warn('Invalid command module found:', mod);
  }
});

// Register additional commands from addalt.js that export multiple commands
if (addalt.switchData && typeof addalt.executeSwitch === 'function') {
  const switchCommand = {
    data: addalt.switchData,
    execute: addalt.executeSwitch
  };
  commands.set('switch', switchCommand);
  console.log('Registered command: switch');
}

if (addalt.rosterData && typeof addalt.executeRoster === 'function') {
  const rosterCommand = {
    data: addalt.rosterData,
    execute: addalt.executeRoster
  };
  commands.set('roster', rosterCommand);
  console.log('Registered command: roster');
}

if (addalt.deleteAltData && typeof addalt.executeDeleteAlt === 'function') {
  const deleteAltCommand = {
    data: addalt.deleteAltData,
    execute: addalt.executeDeleteAlt
  };
  commands.set('deletealt', deleteAltCommand);
  console.log('Registered command: deletealt');
}

console.log(`Total commands registered: ${commands.size}`);

// Attach to client (so interactionCreate can do client.commands.get(name))
export function loadCommands(client) {
  client.commands = commands;
  console.log(`Commands loaded to client: ${commands.size} total`);
}

// Helper to get all command data for deployment
export function getAllCommandData() {
  const commandData = [];
  
  for (const [name, command] of commands) {
    if (command.data && typeof command.data.toJSON === 'function') {
      commandData.push(command.data.toJSON());
    }
  }
  
  return commandData;
}