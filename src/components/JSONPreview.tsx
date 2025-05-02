'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface JSONPreviewProps {
  data: any;
  title?: string;
  maxHeight?: string;
  className?: string;
}

export function JSONPreview({ data, title = "Configuration JSON (Read-only)", maxHeight = "max-h-60", className = "" }: JSONPreviewProps) {
  const [copied, setCopied] = useState(false);

  // Format the JSON string with proper indentation
  const formattedJson = JSON.stringify(data, null, 2);
  const jsonLines = formattedJson.split('\n');

  const copyToClipboard = () => {
    // Copy only the formatted JSON content without line numbers
    navigator.clipboard.writeText(formattedJson);
    
    // Show copied state briefly
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <Label htmlFor="configJson" className="text-base font-medium">
          {title}
        </Label>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 flex items-center gap-1.5"
          onClick={copyToClipboard}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-xs">Copy All</span>
            </>
          )}
        </Button>
      </div>
      <div className={`rounded-md mt-1 overflow-auto ${maxHeight}`}>
        <pre className="p-4 bg-slate-900 text-slate-50 text-sm flex">
          {/* Line numbers column */}
          <div className="select-none text-right pr-3 border-r border-slate-700 mr-3 text-slate-500 font-mono" style={{ minWidth: '2.5rem' }}>
            {jsonLines.map((_, i) => (
              <div key={`line-${i}`} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>
          {/* JSON content */}
          <code className="font-mono leading-6">
            {jsonLines.map((line, i) => (
              <div key={`content-${i}`}>
                {line}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

export default JSONPreview; 