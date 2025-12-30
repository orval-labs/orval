import { basename } from 'path';
import { useEffect, useState } from 'react';
import { Editor } from './Editor';
import type { GenerateOutput } from '@/pages/api/generate';
import type { editor } from 'monaco-editor';

interface Props {
  outputArray?: GenerateOutput[];
  editorProps?: editor.IStandaloneEditorConstructionOptions;
  error?: string;
  height?: string | number;
}

export function CodegenOutput({
  outputArray,
  editorProps,
  error,
  height,
}: Props) {
  const [index, setIndex] = useState(0);
  const editorContent = error || outputArray?.[index].content || '';

  useEffect(() => {
    setIndex(0);
  }, [outputArray]);

  return (
    <>
      <div>
        <div>
          {outputArray?.map((outputItem, i) => (
            <div onClick={() => setIndex(i)} key={outputItem.filename}>
              {basename(outputItem.filename)}
            </div>
          )) || 'endpoints.ts'}
        </div>
      </div>
      <Editor {...editorProps} value={editorContent} height={height} />
    </>
  );
}
