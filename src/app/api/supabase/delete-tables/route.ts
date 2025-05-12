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
    
    // Define the tables to delete
    const tablesToDrop = ['scan_configs', 'scan_history'];
    
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
    
    if (!tablesExist) {
      return NextResponse.json({ 
        message: 'No tables found to delete',
      });
    }
    
    // Simply return the SQL commands for manual execution
    return NextResponse.json({
      message: 'Please run these SQL commands in the Supabase SQL Editor to delete tables:',
      sql_commands: tablesToDrop.map(table => `DROP TABLE IF EXISTS ${table} CASCADE;`)
    });
    
  } catch (error) {
    console.error('Error in delete-tables endpoint:', error);
    return NextResponse.json({
      error: 'Failed to check tables: ' + (error instanceof Error ? error.message : String(error)),
      sql_commands: ['DROP TABLE IF EXISTS scan_configs CASCADE;', 'DROP TABLE IF EXISTS scan_history CASCADE;'],
    }, { status: 500 });
  }
}

// Helper function to read settings file
async function readSettingsFile() {
  try {
    const fs = require('fs');
    const path = require('path');
    const settingsPath = path.join(process.cwd(), '.app_settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      return null;
    }
    
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(settingsContent);
  } catch (error) {
    console.error('Error reading settings file:', error);
    return null;
  }
} 