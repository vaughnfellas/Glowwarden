// src/db.js
// Centralized Supabase client for the entire application
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const supabaseUrl = process.env.SUPABASE_URL || config.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || config.SUPABASE_SERVICE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
