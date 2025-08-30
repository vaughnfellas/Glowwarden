// ============= src/events/index.js =============
import * as readyEvent from './ready.js';
import * as voiceStateUpdateEvent from './voice-state-update.js';
import * as interactionButtonsEvent from '../commands/interaction-buttons.js';

const events = [
  readyEvent,
  voiceStateUpdateEvent,
  interactionButtonsEvent,       // 👈 include in the array
];

export function loadEvents(client) {
  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  console.log(`Loaded ${events.length} events`);
}
