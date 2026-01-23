import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      console.error('Check Table: Supabase client not available. Check configuration.');
      return NextResponse.json(
        { error: 'Supabase is not configured correctly. Please check your URL and key in Settings.' },
        { status: 400 }
      );
    }

    // Get the table name from the request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid request body, failed to parse JSON' },
        { status: 400 }
      );
    }

    const { table } = body;

    if (!table) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      );
    }

    // Log the table we're checking and Supabase URL (without key for security)
    console.log(`Check Table: Checking if table ${table} exists`);

    // Check if the table exists by querying it
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        // If the error is "relation does not exist" or "schema cache" error, 
        // it likely means the table hasn't been created yet.
        if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
          console.log(`Check Table: Table ${table} does not exist (Error: ${error.message})`);
          return NextResponse.json({ exists: false });
        }

        // For other errors, return the error
        console.error(`Check Table: Error checking table ${table}`, error);
        return NextResponse.json(
          { error: `Error checking table: ${error.message}` },
          { status: 500 }
        );
      }

      // If there's no error, the table exists
      console.log(`Check Table: Table ${table} exists`);
      return NextResponse.json({ exists: true });
    } catch (queryError) {
      console.error(`Check Table: Exception checking table ${table}`, queryError);
      return NextResponse.json(
        { error: `Exception checking table: ${queryError instanceof Error ? queryError.message : String(queryError)}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error checking table existence:', error);

    let errorMessage = 'Failed to check table existence';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 