'use client';

import { ChevronDown } from 'lucide-react';
import type { ExampleCategory } from '@/lib/playground/types';

interface ExampleSelectorProps {
  examples: ExampleCategory[];
  value: string;
  onChange: (selectId: string) => void;
}

export const ExampleSelector = ({ examples, value, onChange }: ExampleSelectorProps) => {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-4 py-3 pr-10 rounded-lg bg-black/60 border border-white/10 text-white text-sm font-medium cursor-pointer hover:border-[#6F40C9]/50 focus:border-[#6F40C9] focus:outline-none focus:ring-1 focus:ring-[#6F40C9] transition-colors"
      >
        {examples.map((category) => (
          <optgroup key={category.label} label={category.label} className="bg-[#1a0a2e] text-gray-300">
            {category.options.map((example) => (
              <option
                key={example.selectId}
                value={example.selectId}
                className="bg-[#1a0a2e] text-white py-2"
              >
                {example.name}
                {example.tags.length > 0 ? ` (${example.tags.join(', ')})` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
};
