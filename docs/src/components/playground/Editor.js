import MonacoEditor from '@monaco-editor/react';

const canUseDOM = typeof window !== 'undefined';

export const Editor = ({ value, lang, readOnly, onEdit, height = 500 }) => {
  if (!canUseDOM) {
    return null;
  }

  return (
    <MonacoEditor
      height={height}
      language={lang}
      theme="vs-dark"
      value={value}
      options={{
        readOnly,
        minimap: {
          enabled: false,
        },
      }}
      onChange={onEdit}
    />
  );
};
