import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
});

pool.on('error', (err) => {
  console.error('Pool error:', err.message);
});

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    client.release();
    console.log('✅  PostgreSQL connected —', res.rows[0].now);
  } catch (err) {
    console.error('❌  Connection failed:', err.message);
    process.exit(1);
  }
};
