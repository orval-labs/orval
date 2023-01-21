import { basename } from 'path';
import { useEffect, useState } from 'react';
import { Editor } from './Editor';

export const CodegenOutput = ({ outputArray, editorProps, error, height }) => {
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
          ))}
        </div>
      </div>
      <Editor {...editorProps} value={editorContent} height={height} />
    </>
  );
};
