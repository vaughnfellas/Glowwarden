// Create a test file: test-token.js
import { config } from './src/config.js';
console.log('Token exists:', !!config.DISCORD_TOKEN);
console.log('Token starts with:', config.DISCORD_TOKEN?.substring(0, 10));