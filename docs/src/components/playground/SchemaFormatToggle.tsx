import {
  SCHEMA_FORMATS,
  type SchemaFormat,
} from '@/lib/playground/schema-format';

interface SchemaFormatToggleProps {
  label: string;
  value: SchemaFormat;
  onChange: (format: SchemaFormat) => void;
}

export const SchemaFormatToggle = ({
  label,
  value,
  onChange,
}: SchemaFormatToggleProps) => {
  return (
    <fieldset className="flex rounded-md border border-white/10 overflow-hidden text-xs font-medium">
      <legend className="sr-only">{label}</legend>
      {SCHEMA_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          aria-pressed={value === format}
          onClick={() => {
            if (format !== value) {
              onChange(format);
            }
          }}
          className={`px-2 py-0.5 uppercase transition-colors ${
            value === format
              ? 'bg-[#6F40C9] text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {format}
        </button>
      ))}
    </fieldset>
  );
};
