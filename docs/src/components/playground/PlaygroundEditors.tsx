import type { GenerateOutput } from '@/pages/api/generate';
import { CodegenOutput } from './CodegenOutput';
import { Editor } from './Editor';

interface Props {
  setSchema?: (value: string | undefined) => void;
  schema?: string;
  setConfig?: (value: string | undefined) => void;
  config?: string;
  error?: string;
  output?: GenerateOutput[];
  height?: string | number;
}

export function PlaygroundEditors({
  setSchema,
  schema,
  setConfig,
  config,
  error,
  output,
  height,
}: Props) {
  return (
    <div className="grid grid-cols-3">
      <div>
        <div>
          {/* <Image
            alt="GraphQL"
            src={graphqlLogo}
            placeholder="empty"
            loading="eager"
            className="h-7 w-7"
          /> */}
          <span>schema.yaml</span>
        </div>
        <Editor lang="yaml" onEdit={setSchema} value={schema} height={height} />
      </div>
      <div>
        <div>
          {/*    <Image
            alt="Codegen"
            src={gqlCodegenIcon}
            placeholder="empty"
            loading="eager"
            className="h-7 w-7"
          /> */}
          <span>orval.config.ts</span>
        </div>
        <Editor lang="json" onEdit={setConfig} value={config} height={height} />
      </div>
      <div>
        <CodegenOutput
          editorProps={{
            language: 'text/typescript',
            readOnly: true,
          }}
          error={error}
          outputArray={output}
          height={height}
        />
      </div>
    </div>
  );
}
