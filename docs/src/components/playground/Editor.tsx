import dynamic from 'next/dynamic';
// https://github.com/suren-atoyan/monaco-react?tab=readme-ov-file#for-nextjs-users
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

interface Props {
  value?: string;
  lang?: string;
  readOnly?: boolean;
  height?: string | number;
  onEdit?: (value: string | undefined) => void;
}

export function Editor({ value, lang, readOnly, onEdit, height = 500 }: Props) {
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
}
