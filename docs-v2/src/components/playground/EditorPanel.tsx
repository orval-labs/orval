'use client';

import Editor from '@monaco-editor/react';

interface EditorPanelProps {
  title: string;
  language: string;
  value: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
}

export const EditorPanel = ({
  title,
  language,
  value,
  onChange,
  readOnly = false,
  height = '400px',
}: EditorPanelProps) => {
  return (
    <div className="flex flex-col rounded-xl bg-black/60 border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-sm font-medium text-gray-300">{title}</span>
      </div>
      <div className="flex-1">
        <Editor
          height={height}
          language={language}
          theme="vs-dark"
          value={value}
          onChange={onChange}
          options={{
            readOnly,
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
              <div className="animate-pulse text-gray-500">Loading editor...</div>
            </div>
          }
        />
      </div>
    </div>
  );
};
