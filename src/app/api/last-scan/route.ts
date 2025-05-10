import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ScanResult } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Check if using Supabase
    const useSupabase = await isUsingSupabase();
    
    if (useSupabase) {
      try {
        return await getLastScanFromSupabase();
      } catch (supabaseError) {
        console.error('Error getting last scan from Supabase:', supabaseError);
        // Return empty data for Supabase failures rather than falling back to files
        // This ensures consistent behavior with other API routes
        return NextResponse.json({
          id: null,
          url: null,
          date: null,
          brokenLinks: 0,
          totalLinks: 0,
          error: 'No scan history available'
        });
      }
    } else {
      return await getLastScanFromFiles();
    }
  } catch (error) {
    console.error('Error fetching last scan:', error);
    // Return empty placeholder instead of error to avoid breaking the UI
    return NextResponse.json({
      id: null,
      url: null,
      date: null,
      brokenLinks: 0,
      totalLinks: 0,
      error: 'No scan history available'
    });
  }
}

async function getLastScanFromFiles() {
  try {
    // Path to the scan history directory
    const historyDir = path.join(process.cwd(), '.scan_history');
    
    // Ensure the directory exists
    if (!fs.existsSync(historyDir)) {
      return NextResponse.json({
        id: null,
        url: null,
        date: null,
        brokenLinks: 0,
        totalLinks: 0,
        error: 'No scan history found'
      });
    }
    
    // Get all scan files
    const files = fs.readdirSync(historyDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(historyDir, file);
        const stats = fs.statSync(filePath);
        return {
          file,
          id: file.replace('.json', ''),
          mtime: stats.mtime.getTime()
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // Sort by most recent first
    
    // If no files found
    if (files.length === 0) {
      return NextResponse.json({
        id: null,
        url: null,
        date: null,
        brokenLinks: 0,
        totalLinks: 0,
        error: 'No scan history found'
      });
    }
    
    // Get the most recent scan file
    const mostRecentFile = files[0];
    const filePath = path.join(historyDir, mostRecentFile.file);
    const scanData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Count broken links
    const brokenLinks = Array.isArray(scanData.results) 
      ? scanData.results.filter((result: ScanResult) => 
          result.status === 'broken' || 
          (result.statusCode !== undefined && result.statusCode >= 400) ||
          result.status === 'error'
        ).length
      : 0;
    
    // Return simplified scan data for the homepage
    return NextResponse.json({
      id: mostRecentFile.id,
      url: scanData.scanUrl,
      date: scanData.scanDate,
      brokenLinks,
      totalLinks: scanData.results.length,
    });
  } catch (error) {
    console.error('Error fetching last scan from files:', error);
    // Return an empty result rather than throwing the error
    return NextResponse.json({
      id: null,
      url: null,
      date: null,
      brokenLinks: 0,
      totalLinks: 0,
      error: 'Error loading scan history'
    });
  }
}

async function getLastScanFromSupabase() {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      throw new Error('Supabase client is not available');
    }
    
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .order('scan_date', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json({
          id: null,
          url: null,
          date: null,
          brokenLinks: 0,
          totalLinks: 0,
          error: 'No scan history found'
        });
      }
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!data) {
      return NextResponse.json({
        id: null,
        url: null,
        date: null,
        brokenLinks: 0,
        totalLinks: 0,
        error: 'No scan history found'
      });
    }
    
    // Count broken links
    let resultsArr: any[] = [];
    if (Array.isArray(data.results)) {
      resultsArr = data.results;
    } else if (data.results && typeof data.results === 'object') {
      resultsArr = Object.values(data.results);
    }
    
    const brokenLinks = resultsArr.filter((result: ScanResult) => 
      result.status === 'broken' || 
      (result.statusCode !== undefined && result.statusCode >= 400) ||
      result.status === 'error'
    ).length;
    
    // Return simplified scan data for the homepage
    return NextResponse.json({
      id: data.id,
      url: data.scan_url,
      date: data.scan_date,
      brokenLinks,
      totalLinks: resultsArr.length,
    });
  } catch (error) {
    console.error('Error fetching last scan from Supabase:', error);
    // Rethrow to be handled by the parent try/catch
    throw error;
  }
} 