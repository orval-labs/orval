import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';

import {
  DEFAULT_EXAMPLE,
  EXAMPLES,
  getGroupedExamples,
} from '@/lib/playground/examples';
import { generatePlaygroundCode } from '@/lib/playground/generate';
import type { GenerateOutput } from '@/lib/playground/types';

import { EditorPanel } from './EditorPanel';
import { ExampleSelector } from './ExampleSelector';
import { OutputPanel } from './OutputPanel';

const groupedExamples = getGroupedExamples();

export const Playground = () => {
  const [selectedExample, setSelectedExample] = useState(
    `${DEFAULT_EXAMPLE.catName}__${DEFAULT_EXAMPLE.index}`,
  );
  const [schema, setSchema] = useState(
    EXAMPLES[DEFAULT_EXAMPLE.catName][DEFAULT_EXAMPLE.index].schema,
  );
  const [config, setConfig] = useState(
    EXAMPLES[DEFAULT_EXAMPLE.catName][DEFAULT_EXAMPLE.index].config,
  );

  const [debouncedSchema] = useDebounce(schema, 500);
  const [debouncedConfig] = useDebounce(config, 500);

  const {
    mutate: generate,
    data: output,
    error,
    isPending,
  } = useMutation<GenerateOutput[], Error, { schema: string; config: string }>({
    mutationFn: async ({ schema, config }) => {
      const result = await generatePlaygroundCode({ data: { schema, config } });
      return result;
    },
  });

  // Auto-generate on debounced input changes
  useEffect(() => {
    if (debouncedSchema && debouncedConfig) {
      generate({ schema: debouncedSchema, config: debouncedConfig });
    }
  }, [debouncedSchema, debouncedConfig, generate]);

  const handleExampleChange = (selectId: string) => {
    const [catName, indexStr] = selectId.split('__');
    const index = Number.parseInt(indexStr, 10);
    const example = EXAMPLES[catName][index];

    setSelectedExample(selectId);
    setSchema(example.schema);
    setConfig(example.config);
  };

  const handleSchemaChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSchema(value);
    }
  };

  const handleConfigChange = (value: string | undefined) => {
    if (value !== undefined) {
      setConfig(value);
    }
  };

  return (
    <div className="w-full">
      {/* Example selector */}
      <div className="max-w-md mx-auto mb-8">
        <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
          Choose an example
        </label>
        <ExampleSelector
          examples={groupedExamples}
          value={selectedExample}
          onChange={handleExampleChange}
        />
      </div>

      {/* Editor grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Schema editor */}
        <EditorPanel
          title="schema.yaml"
          language="yaml"
          value={schema}
          onChange={handleSchemaChange}
          height="500px"
        />

        {/* Config editor */}
        <EditorPanel
          title="orval.config.ts"
          language="json"
          value={config}
          onChange={handleConfigChange}
          height="500px"
        />

        {/* Output panel */}
        <OutputPanel
          output={output}
          error={error?.message}
          isLoading={isPending}
          height="500px"
        />
      </div>
    </div>
  );
};
