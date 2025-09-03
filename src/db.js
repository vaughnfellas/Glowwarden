// src/db.js
// Centralized Supabase client for the entire application
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const supabaseUrl = process.env.SUPABASE_URL || config.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || config.SUPABASE_SERVICE_KEY;

// Validate required Supabase credentials
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required Supabase credentials:');
  console.error('- SUPABASE_URL:', !!supabaseUrl);
  console.error('- SUPABASE_SERVICE_KEY:', !!supabaseKey);
  process.exit(1);
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection on startup
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.warn('⚠️ Supabase connection test failed:', error.message);
      console.warn('This might be because the characters table doesn\'t exist yet.');
    } else {
      console.log('✅ Supabase connected successfully');
    }
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
  }
}

// Run connection test
testConnection();

// Export helper functions for backward compatibility
export const query = async (text, params) => {
  console.warn('⚠️ query() function is deprecated. Use supabase client directly.');
  throw new Error('Direct SQL queries not supported with Supabase. Use the supabase client methods instead.');
};

// Legacy compatibility
export const db = { 
  query,
  supabase // Expose supabase client through db object
};

// Graceful shutdown handler (though Supabase doesn't require explicit closing)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log('🔄 Shutting down Supabase connections...');
    // Supabase client handles cleanup automatically
    process.exit(0);
  });
}