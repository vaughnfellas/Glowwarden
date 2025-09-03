// commands/index.js - Command registration
import { Events, MessageFlags } from 'discord.js';

import * as decreeCommand from '../decree.js';
import * as vcStatusCommand from './vc-status.js';
import * as addaltCommand from './addalt.js';

// ONE source of truth: export a single map with everything
export const commands = new Map([
  [decreeCommand.data.name, decreeCommand],
  [vcStatusCommand.data.name, vcStatusCommand],
  [addaltCommand.data.name, addaltCommand],
  [addaltCommand.switchData.name, { execute: addaltCommand.executeSwitch, data: addaltCommand.switchData }],
  [addaltCommand.rosterData.name, { execute: addaltCommand.executeRoster, data: addaltCommand.rosterData }],
  [addaltCommand.deleteAltData.name, { execute: addaltCommand.executeDeleteAlt, data: addaltCommand.deleteAltData }],
]);