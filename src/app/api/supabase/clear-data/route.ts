import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      console.error('Clear Data: Supabase client not available. Check configuration.');
      return NextResponse.json(
        { error: 'Supabase is not configured correctly. Please check your URL and key in Settings.' },
        { status: 400 }
      );
    }
    
    // Test the connection first
    try {
      const { data, error } = await supabase.from('_dummy_query_').select('*').limit(1);
      
      // If we get a "relation does not exist" error, this is actually good!
      // It means we connected to the database successfully but the table doesn't exist (as expected)
      if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        // Only treat it as an auth error if it's NOT a "relation does not exist" error
        console.error('Clear Data: Authentication error with Supabase', error);
        return NextResponse.json(
          { error: 'Cannot connect to Supabase. Please check your credentials.' },
          { status: 401 }
        );
      }
      
      // If we get here, either there was no error (unlikely) or we got the expected
      // "relation does not exist" error, which means the connection is working
      console.log('Clear Data: Connection to Supabase successful');
      
    } catch (connectionError) {
      console.error('Clear Data: Connection test failed', connectionError);
      return NextResponse.json(
        { error: 'Failed to connect to Supabase. Please verify your URL and key.' },
        { status: 400 }
      );
    }
    
    // Track table existence and data clearing
    let tablesExist = false;
    let dataCleared = false;
    
    // Clear data from each table
    try {
      // 1. Check if scan_configs exists first
      const { data: configData, error: configCheckError } = await supabase
        .from('scan_configs')
        .select('id')
        .limit(1);
        
      if (!configCheckError) {
        // Table exists, delete all data
        tablesExist = true;
        const { error: configsError } = await supabase
          .from('scan_configs')
          .delete()
          .lt('id', 'z'); // This will match all IDs and delete them
        
        if (configsError) {
          console.error('Clear Data: Error clearing scan_configs table', configsError);
          throw new Error(`Error clearing scan_configs table: ${configsError.message}`);
        }
        
        dataCleared = true;
      }
      
      // 2. Check if scan_history exists
      const { data: historyData, error: historyCheckError } = await supabase
        .from('scan_history')
        .select('id')
        .limit(1);
        
      if (!historyCheckError) {
        // Table exists, delete all data
        tablesExist = true;
        const { error: historyError } = await supabase
          .from('scan_history')
          .delete()
          .lt('id', 'z'); // This will match all IDs and delete them
        
        if (historyError) {
          console.error('Clear Data: Error clearing scan_history table', historyError);
          throw new Error(`Error clearing scan_history table: ${historyError.message}`);
        }
        
        dataCleared = true;
      }
      
      // 3. Check if scan_params exists
      const { data: paramsData, error: paramsCheckError } = await supabase
        .from('scan_params')
        .select('id')
        .limit(1);
        
      if (!paramsCheckError) {
        // Table exists, delete all data
        tablesExist = true;
        const { error: paramsError } = await supabase
          .from('scan_params')
          .delete()
          .lt('id', 'z'); // This will match all IDs and delete them
        
        if (paramsError) {
          console.error('Clear Data: Error clearing scan_params table', paramsError);
          throw new Error(`Error clearing scan_params table: ${paramsError.message}`);
        }
        
        dataCleared = true;
      }
      
      if (!tablesExist) {
        return NextResponse.json({ 
          message: 'No tables found in Supabase database', 
          error: 'No tables exist to clear data from'
        });
      }
      
      if (!dataCleared) {
        return NextResponse.json({ 
          message: 'Tables exist but no data was cleared', 
          warning: 'Tables may be empty already'
        });
      }
      
    } catch (clearError) {
      console.error('Clear Data: Error clearing data', clearError);
      return NextResponse.json(
        { error: clearError instanceof Error ? clearError.message : 'Failed to clear data from Supabase tables' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      message: 'Data successfully cleared from all Supabase tables' 
    });
  } catch (error) {
    console.error('Error clearing Supabase table data:', error);
    
    let errorMessage = 'Failed to clear Supabase table data';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 