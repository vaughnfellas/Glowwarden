// src/events/index.js
import * as readyEvent from './ready.js';
import * as interactionCreateEvent from './interactionCreate.js';
import * as voiceStateUpdateEvent from './voiceStateUpdate.js';

const events = [readyEvent, interactionCreateEvent, voiceStateUpdateEvent];

export function loadEvents(client) {
  for (const e of events) {
    if (!e?.name || !e?.execute) continue;
    e.once
      ? client.once(e.name, (...a) => e.execute(...a))
      : client.on(e.name, (...a) => e.execute(...a));
  }
}
