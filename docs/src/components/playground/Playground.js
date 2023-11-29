//import { Image, useTheme } from '@theguild/components';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import Select from 'react-select';
import { EXAMPLES } from './Examples';
import { PlaygroundEditors } from './PlaygroundEditors';

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
};

export function Playground({ height }) {
  const [template, setTemplate] = useState(
    `${DEFAULT_EXAMPLE.catName}__${DEFAULT_EXAMPLE.index}`,
  );
  const [schema, setSchema] = useState(
    EXAMPLES[DEFAULT_EXAMPLE.catName][DEFAULT_EXAMPLE.index].schema,
  );
  const [config, setConfig] = useState(
    EXAMPLES[DEFAULT_EXAMPLE.catName][DEFAULT_EXAMPLE.index].config,
  );

  const { data: output, error } = useQuery(
    [config, schema, template],
    async () => {
      const response = await axios.post('/api/generate', {
        config,
        schema,
      });

      return response.data;
    },
    {
      retry: false,
    },
  );

  const changeTemplate = (value) => {
    const [catName, index] = value.split('__');
    setSchema(EXAMPLES[catName][index].schema);
    setConfig(EXAMPLES[catName][index].config);
    setTemplate(value);
  };

  return (
    <div>
      <div className="mx-auto mb-4 w-1/2">
        <h3 className="mb-2 text-center">Choose Live Example:</h3>
        <Select
          isSearchable={false}
          className="
            rounded-md
            [&>div]:dark:bg-black
            [&>div>div>div]:dark:text-gray-200
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
          onChange={(e) => changeTemplate(e.selectId)}
          getOptionValue={(o) => o.selectId}
          getOptionLabel={(o) => (
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
      {output ? (
        <PlaygroundEditors
          setSchema={setSchema}
          schema={schema}
          setConfig={setConfig}
          config={config}
          error={error?.response?.data?.error}
          output={output}
          height={height}
        />
      ) : null}
    </div>
  );
}
