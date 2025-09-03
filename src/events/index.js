// events/index.js - Event handler registration
import * as readyEvent from './ready.js';
import * as interactionCreateEvent from '../interaction-handler.js';

const events = [
  readyEvent,
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
}