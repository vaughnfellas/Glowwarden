// ============= src/events/index.js =============
 import * as readyEvent from './ready.js';
 import * as voiceStateUpdateEvent from './voice-state-update.js';
 import * as interactionHandlerEvent from './interaction-handler.js';

const events = [
  readyEvent,
  voiceStateUpdateEvent,
  interactionButtonsEvent,       
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
