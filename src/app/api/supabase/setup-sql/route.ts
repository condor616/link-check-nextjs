import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Get Supabase client
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      console.error('Setup SQL: Supabase client not available. Check configuration.');
      return NextResponse.json(
        { error: 'Supabase is not configured correctly. Please check your URL and key in Settings.' },
        { status: 400 }
      );
    }
    
    // Check if connection to Supabase is working
    try {
      const { error: connectionError } = await supabase.from('scan_history').select('id').limit(1);
      
      // If we get a "does not exist" error, that's fine - it means we can connect but the table doesn't exist yet
      // Any other error indicates a connection or permission problem
      if (connectionError && !connectionError.message.includes('does not exist')) {
        console.error('Setup SQL: Connection error', connectionError);
        return NextResponse.json(
          { 
            error: 'Could not connect to Supabase or insufficient permissions',
            details: connectionError.message
          },
          { status: 400 }
        );
      }
    } catch (connectionErr) {
      console.error('Setup SQL: Connection test failed', connectionErr);
      return NextResponse.json(
        { 
          error: 'Failed to test connection to Supabase',
          details: connectionErr instanceof Error ? connectionErr.message : String(connectionErr)
        },
        { status: 400 }
      );
    }
    
    // Since we cannot directly execute SQL with the JavaScript SDK, we'll use another approach.
    // We'll try to create empty tables by inserting and then deleting a record, which will create the tables if they don't exist.
    
    try {
      // 1. Try to create scan_configs table by UPSERT operation
      const configResult = await supabase
        .from('scan_configs')
        .upsert({
          id: 'temp_setup_id',
          name: 'Temporary Setup Entry',
          url: 'https://example.com',
          config: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (configResult.error && !configResult.error.message.includes('does not exist')) {
        console.error('Setup SQL: Error with scan_configs table', configResult.error);
        throw new Error(`Error setting up scan_configs table: ${configResult.error.message}`);
      }
      
      // Delete the temporary record if it was created
      await supabase
        .from('scan_configs')
        .delete()
        .eq('id', 'temp_setup_id');
      
      // 2. Try to create scan_history table by UPSERT operation
      const historyResult = await supabase
        .from('scan_history')
        .upsert({
          id: 'temp_setup_id',
          scan_url: 'https://example.com',
          scan_date: new Date().toISOString(),
          duration_seconds: 0,
          config: {},
          results: []
        });
      
      if (historyResult.error && !historyResult.error.message.includes('does not exist')) {
        console.error('Setup SQL: Error with scan_history table', historyResult.error);
        throw new Error(`Error setting up scan_history table: ${historyResult.error.message}`);
      }
      
      // Delete the temporary record if it was created
      await supabase
        .from('scan_history')
        .delete()
        .eq('id', 'temp_setup_id');
      
      // If we've made it here, either tables already exist or we need to let the user set them up manually
      // Check if we got "does not exist" errors, which means tables need creation
      if (
        (configResult.error && configResult.error.message.includes('does not exist')) ||
        (historyResult.error && historyResult.error.message.includes('does not exist'))
      )
        return NextResponse.json({
          error: 'Tables do not exist in your Supabase database. Please run the provided SQL commands in the Supabase SQL editor.',
          message: 'Tables need to be created manually',
          sql_commands: [
            `CREATE TABLE IF NOT EXISTS scan_configs (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, config JSONB NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`,
            `CREATE TABLE IF NOT EXISTS scan_history (id TEXT PRIMARY KEY, scan_url TEXT NOT NULL, scan_date TIMESTAMP WITH TIME ZONE NOT NULL, duration_seconds NUMERIC NOT NULL, config JSONB NOT NULL, results JSONB NOT NULL);`
          ]
        }, { status: 202 }); // Status 202 Accepted - tables need to be created manually
      
      // If we made it here without errors or "does not exist" errors, tables are ready
      return NextResponse.json({
        message: 'Supabase tables are set up and ready to use',
        tables: ['scan_configs', 'scan_history']
      });
      
    } catch (sqlError) {
      console.error('Setup SQL: Table setup error', sqlError);
      return NextResponse.json({
        error: 'Failed to set up Supabase tables. You may need to run these SQL commands manually in the Supabase dashboard SQL editor:',
        sql_commands: [
          `CREATE TABLE IF NOT EXISTS scan_configs (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, config JSONB NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`,
          `CREATE TABLE IF NOT EXISTS scan_history (id TEXT PRIMARY KEY, scan_url TEXT NOT NULL, scan_date TIMESTAMP WITH TIME ZONE NOT NULL, duration_seconds NUMERIC NOT NULL, config JSONB NOT NULL, results JSONB NOT NULL);`
        ]
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Setup SQL: Unexpected error', error);
    return NextResponse.json(
      { error: 'Failed to set up Supabase tables: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
} 