// ============= src/health-server.js =============
import express from 'express';
import { config } from './config.js';
import { sweepTempRooms } from './services/temp-vc-service.js';

// Track if Discord has connected successfully
let discordConnected = false;

// Function to notify health server that Discord is connected
export function notifyDiscordConnected() {
  discordConnected = true;
}

export function startHealthServer() {
  const app = express();
  const port = process.env.PORT || config.PORT || 3000;
  
  // Original health endpoint (keep for backward compatibility)
  app.get('/healthz', (req, res) => {
    res.send('ok');
  });
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.send('Spore Inviter up');
  });
  
  // Dedicated warm endpoint - DOESN'T trigger Discord reconnection
  app.get('/warm', (req, res) => {
    // This endpoint just returns status without touching Discord
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'spore-inviter',
      // Only report Discord status, don't trigger reconnection
      discord: discordConnected ? 'connected' : 'not connected'
    });
  });
  
  // Manual sweep endpoint
  app.get('/sweep', async (req, res) => {
    await sweepTempRooms();
    res.send('sweep-ok');
  });
  
  app.listen(port, () => {
    console.log(`Health server listening on ${port}`);
  });
}