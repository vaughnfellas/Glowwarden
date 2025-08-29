// ============= src/health-server.js =============
import express from 'express';
import { config } from './config.js';
import { sweepTempRooms } from './services/temp-vc-service.js';

export function startHealthServer() {
  const app = express();
  
  app.get('/', (_req, res) => res.send('Spore Inviter up'));
  app.get('/healthz', (_req, res) => res.send('ok'));
  
  // Manual sweep endpoint
  app.get('/sweep', async (_req, res) => {
    await sweepTempRooms();
    res.send('sweep-ok');
  });
  
  app.listen(config.PORT, () => {
    console.log(`Health server listening on ${config.PORT}`);
  });
}