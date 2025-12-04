import { NextResponse } from 'next/server';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: Request) {
  try {
    // Extract the scan ID from the URL query parameters
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('id');

    if (!scanId) {
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      try {
        const supabase = await getSupabaseClient();

        if (!supabase) {
          throw new Error('Supabase client is not available');
        }

        const { error } = await supabase
          .from('scan_history')
          .delete()
          .eq('id', scanId);

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }
      } catch (supabaseError) {
        console.error('Error deleting scan from Supabase:', supabaseError);
        // If Supabase fails, we might want to try local DB or just fail
        // For now, let's fail to avoid inconsistency
        return NextResponse.json(
          { error: supabaseError instanceof Error ? supabaseError.message : 'Failed to delete scan from Supabase' },
          { status: 500 }
        );
      }
    } else {
      // Use Prisma (SQLite)
      try {
        await prisma.scanHistory.delete({
          where: {
            id: scanId
          }
        });
      } catch (prismaError) {
        console.error('Error deleting scan from Prisma:', prismaError);
        // Check if record not found
        if (prismaError && typeof prismaError === 'object' && 'code' in prismaError && prismaError.code === 'P2025') {
          return NextResponse.json(
            { error: 'Scan not found' },
            { status: 404 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to delete scan from database' },
          { status: 500 }
        );
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Scan deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting scan:', error);
    return NextResponse.json(
      { error: 'Failed to delete scan' },
      { status: 500 }
    );
  }
} 