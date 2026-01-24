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
      console.log('Setup SQL: Testing connection to Supabase...');
      const { error: connectionError } = await supabase.from('scan_history').select('id').limit(1);

      // If we get a "does not exist" error, that's fine - it means we can connect but the table doesn't exist yet
      if (connectionError) {
        if (connectionError.message.includes('does not exist') || connectionError.message.includes('schema cache')) {
          console.log('Setup SQL: Connection test successful (table does not exist yet).');
        } else {
          console.error('Setup SQL: Connection error detail:', {
            message: connectionError.message,
            code: connectionError.code,
            details: (connectionError as any).details,
            hint: (connectionError as any).hint
          });

          return NextResponse.json(
            {
              error: 'Could not connect to Supabase or insufficient permissions',
              details: connectionError.message,
              code: connectionError.code,
              hint: (connectionError as any).hint
            },
            { status: 400 }
          );
        }
      } else {
        console.log('Setup SQL: Connection test successful (table exists).');
      }
    } catch (connectionErr) {
      console.error('Setup SQL: Connection test exception', connectionErr);
      return NextResponse.json(
        {
          error: 'Failed to test connection to Supabase (Exception)',
          details: connectionErr instanceof Error ? connectionErr.message : String(connectionErr)
        },
        { status: 400 }
      );
    }

    // Since we cannot directly execute SQL with the JavaScript SDK, we'll use another approach.
    // We'll try to create empty tables by inserting and then deleting a record, which will create the tables if they don't exist.

    try {
      // 1. Try to create scan_configs table by UPSERT operation
      const configResult = await (supabase
        .from('scan_configs') as any)
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
      const historyResult = await (supabase
        .from('scan_history') as any)
        .upsert({
          id: 'temp_setup_id',
          scan_url: 'https://example.com',
          scan_date: new Date().toISOString(),
          duration_seconds: 0,
          broken_links: 0,
          total_links: 0,
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

      // 3. Try to create scan_jobs table by UPSERT operation
      const jobsResult = await (supabase
        .from('scan_jobs') as any)
        .upsert({
          id: 'temp_setup_id',
          status: 'stopped',
          scan_url: 'https://example.com',
          created_at: new Date().toISOString(),
          progress_percent: 0,
          urls_scanned: 0,
          total_urls: 0,
          broken_links: 0,
          total_links: 0,
          scan_config: {}
        });

      if (jobsResult.error && !jobsResult.error.message.includes('does not exist')) {
        console.error('Setup SQL: Error with scan_jobs table', jobsResult.error);
        throw new Error(`Error setting up scan_jobs table: ${jobsResult.error.message}`);
      }

      // Delete the temporary record if it was created
      await supabase
        .from('scan_jobs')
        .delete()
        .eq('id', 'temp_setup_id');

      // If we've made it here, either tables already exist or we need to let the user set them up manually
      // Check if we got "does not exist" errors, which means tables need creation
      if (
        (configResult.error && configResult.error.message.includes('does not exist')) ||
        (historyResult.error && historyResult.error.message.includes('does not exist')) ||
        (jobsResult.error && jobsResult.error.message.includes('does not exist'))
      )
        return NextResponse.json({
          error: 'Tables do not exist in your Supabase database. Please run the provided SQL commands in the Supabase SQL editor.',
          message: 'Tables need to be created manually',
          sql_commands: [
            `CREATE TABLE IF NOT EXISTS scan_configs (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, config JSONB NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`,
            `CREATE TABLE IF NOT EXISTS scan_history (id TEXT PRIMARY KEY, scan_url TEXT NOT NULL, scan_date TIMESTAMP WITH TIME ZONE NOT NULL, duration_seconds NUMERIC NOT NULL, broken_links INTEGER DEFAULT 0, total_links INTEGER DEFAULT 0, config JSONB NOT NULL, results JSONB NOT NULL);`,
            `CREATE TABLE IF NOT EXISTS scan_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, scan_url TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), started_at TIMESTAMP WITH TIME ZONE, completed_at TIMESTAMP WITH TIME ZONE, progress_percent NUMERIC DEFAULT 0, current_url TEXT, urls_scanned INTEGER DEFAULT 0, total_urls INTEGER DEFAULT 0, broken_links INTEGER DEFAULT 0, total_links INTEGER DEFAULT 0, scan_config JSONB NOT NULL, error TEXT, results JSONB, state TEXT);`
          ]
        }, { status: 202 }); // Status 202 Accepted - tables need to be created manually

      // If we made it here without errors or "does not exist" errors, tables are ready
      return NextResponse.json({
        message: 'Supabase tables are set up and ready to use',
        tables: ['scan_configs', 'scan_history', 'scan_jobs']
      });

    } catch (sqlError) {
      console.error('Setup SQL: Table setup error', sqlError);
      return NextResponse.json({
        error: 'Failed to set up Supabase tables. You may need to run these SQL commands manually in the Supabase dashboard SQL editor:',
        sql_commands: [
          `CREATE TABLE IF NOT EXISTS scan_configs (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, config JSONB NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`,
          `CREATE TABLE IF NOT EXISTS scan_history (id TEXT PRIMARY KEY, scan_url TEXT NOT NULL, scan_date TIMESTAMP WITH TIME ZONE NOT NULL, duration_seconds NUMERIC NOT NULL, broken_links INTEGER DEFAULT 0, total_links INTEGER DEFAULT 0, config JSONB NOT NULL, results JSONB NOT NULL);`,
          `CREATE TABLE IF NOT EXISTS scan_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, scan_url TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), started_at TIMESTAMP WITH TIME ZONE, completed_at TIMESTAMP WITH TIME ZONE, progress_percent NUMERIC DEFAULT 0, current_url TEXT, urls_scanned INTEGER DEFAULT 0, total_urls INTEGER DEFAULT 0, broken_links INTEGER DEFAULT 0, total_links INTEGER DEFAULT 0, scan_config JSONB NOT NULL, error TEXT, results JSONB, state TEXT);`
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