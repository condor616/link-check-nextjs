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
    
    // List of tables to clear (ALL except users)
    const tablesToClear = [
      'scan_logs', 
      'scan_jobs', 
      'scan_history', 
      'scan_configs', 
      'verification_tokens', 
      'sessions', 
      'accounts'
    ];
    
    // Variables to track if tables exist and if data was cleared
    let tablesFoundCount = 0;
    let tablesClearedCount = 0;
    
    // Clear data from each table
    for (const table of tablesToClear) {
      try {
        // Check if table exists
        const { error: checkError } = await supabase.from(table).select('id').limit(1);
        
        if (!checkError) {
          tablesFoundCount++;
          
          // Table exists, delete all data
          // We use neq('id', -1) or similar as a way to match all rows
          // This works for both string and numeric IDs
          const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .neq('id', -1 as any); 
          
          if (deleteError) {
            console.error(`Clear Data: Error clearing ${table} table`, deleteError);
            // We continue with other tables even if one fails
          } else {
            tablesClearedCount++;
          }
        }
      } catch (err) {
        console.error(`Clear Data: Exception checking/clearing table ${table}`, err);
      }
    }
    
    if (tablesFoundCount === 0) {
      return NextResponse.json({ 
        message: 'No tables found in Supabase database to clear', 
        error: 'No tables exist'
      });
    }
    
    return NextResponse.json({ 
      message: `Data successfully cleared from ${tablesClearedCount} of ${tablesFoundCount} tables.`,
      tablesCleared: tablesClearedCount,
      tablesFound: tablesFoundCount
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