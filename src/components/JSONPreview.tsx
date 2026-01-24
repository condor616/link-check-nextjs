"use client";

import React, { useState } from 'react';
import { Copy, Check, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface JSONPreviewProps {
  data: any;
  title?: string;
  maxHeight?: string;
  className?: string;
  editable?: boolean;
  onSave?: (data: any) => void;
}

export function JSONPreview({
  data,
  title = "Configuration JSON (Read-only)",
  maxHeight = "max-h-60",
  className = "",
  editable = false,
  onSave
}: JSONPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [jsonContent, setJsonContent] = useState<string>(JSON.stringify(data, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  // Format the JSON string with proper indentation if not editable
  const formattedJson = editable ? jsonContent : JSON.stringify(data, null, 2);
  const jsonLines = formattedJson.split('\n');

  const copyToClipboard = () => {
    // Copy only the formatted JSON content without line numbers
    navigator.clipboard.writeText(formattedJson);

    // Show copied state briefly
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveClick = () => {
    if (!onSave) return;

    try {
      const parsedJson = JSON.parse(jsonContent);
      setParseError(null);
      onSave(parsedJson);
    } catch (e) {
      setParseError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonContent(e.target.value);
    // Clear error when user starts typing again
    if (parseError) {
      setParseError(null);
    }
  };

  return (
    <div className={`d-flex flex-column gap-2 ${className}`}>
      <div className="d-flex justify-content-between align-items-center">
        <Label htmlFor="configJson" className="h6 fw-bold mb-0">
          {title}
        </Label>
        <div className="d-flex gap-2">
          {editable && onSave && (
            <button
              className="btn btn-sm btn-secondary d-flex align-items-center gap-1"
              onClick={handleSaveClick}
            >
              <Save size={14} />
              <span className="small">Save</span>
            </button>
          )}
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={copyToClipboard}
          >
            {copied ? (
              <>
                <Check size={14} className="text-success" />
                <span className="small text-success">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span className="small">Copy All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {parseError && (
        <div className="text-danger small">{parseError}</div>
      )}

      {editable ? (
        <textarea
          value={jsonContent}
          onChange={handleJsonChange}
          className={`form-control font-monospace small bg-light ${maxHeight}`}
          rows={10}
          style={{ resize: 'vertical' }}
        />
      ) : (
        <div className={`border rounded bg-dark text-light overflow-auto ${maxHeight}`} style={{ maxHeight: '400px' }}>
          <div className="d-flex p-3">
            {/* Line numbers column */}
            <div className="text-end pe-3 border-end border-secondary me-3 text-muted font-monospace user-select-none opacity-50" style={{ minWidth: '2.5rem' }}>
              {jsonLines.map((_, i) => (
                <div key={`line-${i}`} className="lh-base">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* JSON content */}
            <code className="font-monospace lh-base text-light" style={{ whiteSpace: 'pre' }}>
              {jsonLines.map((line, i) => (
                <div key={`content-${i}`}>
                  {line}
                </div>
              ))}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

export default JSONPreview; 