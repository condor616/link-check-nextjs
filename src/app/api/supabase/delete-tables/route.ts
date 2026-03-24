import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      console.error('Delete Tables: Supabase client not available. Check configuration.');
      return NextResponse.json(
        { error: 'Supabase is not configured correctly. Please check your URL and key in Settings.' },
        { status: 400 }
      );
    }

    // Define the tables to delete in order (respecting foreign keys)
    const tablesToDrop = [
      'scan_logs', 
      'scan_jobs', 
      'scan_history', 
      'scan_configs', 
      'verification_tokens', 
      'sessions', 
      'accounts', 
      'users'
    ];

    // Check if any tables exist
    let tablesExist = false;
    for (const table of tablesToDrop) {
      try {
        const { data, error } = await supabase.from(table).select('id').limit(1);
        if (!error) {
          tablesExist = true;
          break;
        }
      } catch (err) {
        console.error(`Error checking table ${table}:`, err);
      }
    }

    // Always return the SQL commands for manual execution
    return NextResponse.json({
      tablesExist,
      message: tablesExist 
        ? 'Please run these SQL commands in the Supabase SQL Editor to delete tables:'
        : 'No tables found, but here are the SQL commands anyway:',
      sql_commands: tablesToDrop.map(table => `DROP TABLE IF EXISTS ${table} CASCADE;`)
    });

  } catch (error) {
    console.error('Error in delete-tables endpoint:', error);
    return NextResponse.json({
      error: 'Failed to check tables: ' + (error instanceof Error ? error.message : String(error)),
      sql_commands: [
        'DROP TABLE IF EXISTS scan_logs CASCADE;',
        'DROP TABLE IF EXISTS scan_jobs CASCADE;',
        'DROP TABLE IF EXISTS scan_history CASCADE;',
        'DROP TABLE IF EXISTS scan_configs CASCADE;',
        'DROP TABLE IF EXISTS verification_tokens CASCADE;',
        'DROP TABLE IF EXISTS sessions CASCADE;',
        'DROP TABLE IF EXISTS accounts CASCADE;',
        'DROP TABLE IF EXISTS users CASCADE;'
      ],
    }, { status: 500 });
  }
}

