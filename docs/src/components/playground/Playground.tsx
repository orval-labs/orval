//import { Image, useTheme } from '@theguild/components';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useDebounce } from 'use-debounce';
import { EXAMPLES } from './Examples';
import { PlaygroundEditors } from './PlaygroundEditors';
import type { GenerateOutput } from '@/pages/api/generate';

const groupedExamples = Object.entries(EXAMPLES).map(([catName, category]) => ({
  label: catName,
  options: category.map((t, index) => ({
    ...t,
    selectId: `${catName}__${index}`,
  })),
}));

const DEFAULT_EXAMPLE = {
  catName: 'ReactQuery',
  index: 0,
} as const;

// Imports Select dynamically only on the client to avoid hydration warnings in SSR (e.g. aria-activedescendant)
const Select = dynamic(() => import('react-select'), {
  ssr: false,
});

interface Props {
  height?: string | number;
}

export function Playground({ height }: Props) {
  const [template, setTemplate] = useState(
    `${DEFAULT_EXAMPLE.catName}__${DEFAULT_EXAMPLE.index}`,
  );
  const [schema, setSchema] = useState<string | undefined>(
    EXAMPLES[DEFAULT_EXAMPLE.catName][DEFAULT_EXAMPLE.index].schema,
  );
  const [config, setConfig] = useState<string | undefined>(
    EXAMPLES[DEFAULT_EXAMPLE.catName][DEFAULT_EXAMPLE.index].config,
  );
  const [debounceConfig] = useDebounce(config, 500);
  const [debounceSchema] = useDebounce(schema, 500);

  const generateApiQuery = useQuery<GenerateOutput[]>({
    queryKey: [debounceConfig, debounceSchema, template],

    queryFn: async () =>
      (
        await axios.post('/api/generate', {
          config,
          schema,
        })
      ).data,

    retry: false,
    placeholderData: keepPreviousData,
  });

  const changeTemplate = (value) => {
    const [catName, index] = value.split('__');
    setSchema(EXAMPLES[catName][index].schema);
    setConfig(EXAMPLES[catName][index].config);
    setTemplate(value);
  };

  return (
    <div>
      <div className="mx-auto mb-4 w-1/2 relative z-20">
        <h3 className="mb-2 text-center">Choose Live Example:</h3>
        <Select
          isSearchable={false}
          className="
            rounded-md
            dark:[&>div]:bg-black
            dark:[&>div>div>div]:text-gray-200
          "
          styles={{
            option: (styles, { isFocused }) => ({
              ...styles,
              fontSize: 13,
              //  ...(isFocused && isDarkTheme && { backgroundColor: 'gray' }),
            }),
          }}
          isMulti={false}
          isClearable={false}
          onChange={(e: any) => changeTemplate(e.selectId)}
          getOptionValue={(o: any) => o.selectId}
          getOptionLabel={(o: any): any => (
            <div className="flex items-center justify-end gap-1.5">
              <span className="mr-auto">{o.name}</span>
              {o.tags?.map((t) => {
                return (
                  <span
                    key={t}
                    className="rounded-lg bg-gray-200 px-2 text-xs text-gray-800"
                  >
                    {t}
                  </span>
                );
              })}
            </div>
          )}
          defaultValue={groupedExamples[0].options[0]}
          options={groupedExamples}
        />
      </div>
      {generateApiQuery.data || generateApiQuery.error ? (
        <PlaygroundEditors
          setSchema={setSchema}
          schema={schema}
          setConfig={setConfig}
          config={config}
          error={(generateApiQuery.error as any)?.response?.data?.error}
          output={generateApiQuery.data}
          height={height}
        />
      ) : null}
    </div>
  );
}
