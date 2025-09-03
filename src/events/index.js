// ============= src/events/index.js =============
import * as readyEvent from './ready.js';
import * as voiceStateUpdateEvent from './voiceStateUpdate.js';
import * as interactionCreateEvent from './interactionCreate.js';

const events = [
  readyEvent,
  voiceStateUpdateEvent,
  interactionCreateEvent,       
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
