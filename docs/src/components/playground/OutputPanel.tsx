import Editor from '@monaco-editor/react';
import { AlertCircle, Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { GenerateOutput } from '@/lib/playground/types';

interface OutputPanelProps {
  output: GenerateOutput[] | undefined;
  error: string | undefined;
  isLoading: boolean;
  height?: string;
}

export const OutputPanel = ({
  output,
  error,
  isLoading,
  height = '400px',
}: OutputPanelProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!output?.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= output.length) {
      setActiveIndex(output.length - 1);
    }
  }, [output, activeIndex]);

  const activeFile = output?.[activeIndex];
  const content = error || activeFile?.content || '';

  const handleCopy = async () => {
    if (!content || error) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const getFilename = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="flex flex-col rounded-xl bg-black/60 border border-white/10 overflow-hidden">
      {/* Header with tabs */}
      <div className="flex items-center justify-between bg-white/5 border-b border-white/10">
        <div className="flex items-center overflow-x-auto">
          {output && output.length > 0 ? (
            output.map((file, index) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  index === activeIndex
                    ? 'text-white bg-[#6F40C9]/20 border-b-2 border-[#6F40C9]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                {getFilename(file.filename)}
              </button>
            ))
          ) : (
            <span className="px-4 py-2 text-sm font-medium text-gray-400">
              Output
            </span>
          )}
        </div>

        {/* Copy button */}
        {content && !error && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 mr-2 text-xs text-gray-400 hover:text-white transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-[#6F40C9] border-t-transparent rounded-full animate-spin" />
              Generating...
            </div>
          </div>
        )}

        {error ? (
          <div className="p-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  Generation Error
                </p>
                <p className="mt-1 text-sm text-red-300/80 whitespace-pre-wrap">
                  {error}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Editor
            height={height}
            language="typescript"
            theme="vs-dark"
            value={content}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
            }}
            loading={
              <div className="flex items-center justify-center h-full bg-black/60">
                <div className="animate-pulse text-gray-500">
                  Loading editor...
                </div>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
};
