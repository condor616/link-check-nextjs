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
    
    // Variables to track if tables exist and if data was cleared
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