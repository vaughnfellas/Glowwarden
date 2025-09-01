// ============= src/events/index.js =============
import * as readyEvent from './events/ready.js';
import * as voiceStateUpdateEvent from './events/voice-state-update.js';
import * as interactionHandlerEvent from './events/interaction-handler.js';

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
