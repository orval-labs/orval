import { ChevronDown } from 'lucide-react';

import type { Locale } from '@/lib/i18n';
import type { ExampleCategory } from '@/lib/playground/types';

interface ExampleSelectorProps {
  examples: ExampleCategory[];
  id: string;
  label: string;
  locale: Locale;
  value: string;
  onChange: (selectId: string) => void;
}

const exampleNames: Record<Locale, Record<string, string>> = {
  en: {},
  zh: {
    Basic: '基础',
    'With Validation': '带校验',
  },
};

const tagNames: Record<Locale, Record<string, string>> = {
  en: {},
  zh: {
    validation: '校验',
  },
};

export const ExampleSelector = ({
  examples,
  id,
  label,
  locale,
  value,
  onChange,
}: ExampleSelectorProps) => {
  const getExampleName = (name: string) => exampleNames[locale][name] ?? name;
  const getTagName = (tag: string) => tagNames[locale][tag] ?? tag;

  return (
    <div className="relative">
      <select
        aria-label={label}
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="w-full appearance-none px-4 py-3 pr-10 rounded-lg bg-black/60 border border-white/10 text-white text-sm font-medium cursor-pointer hover:border-[#6F40C9]/50 focus:border-[#6F40C9] focus:outline-none focus:ring-1 focus:ring-[#6F40C9] transition-colors"
      >
        {examples.map((category) => (
          <optgroup
            key={category.label}
            label={category.label}
            className="bg-[#1a0a2e] text-gray-300"
          >
            {category.options.map((example) => (
              <option
                key={example.selectId}
                value={example.selectId}
                className="bg-[#1a0a2e] text-white py-2"
              >
                {getExampleName(example.name)}
                {example.tags.length > 0
                  ? ` (${example.tags.map(getTagName).join(', ')})`
                  : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
};
