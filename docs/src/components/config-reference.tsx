import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n';
import type {
  ConfigField,
  RegistryEntry,
  ResolvedShape,
} from '@/generated/config-reference/types';
import { getEntry } from '@/generated/config-reference';

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

const STRINGS = {
  en: {
    type: 'Type',
    default: 'Default',
    optional: 'optional',
    see: 'See',
    callbackParams: 'Callback parameters',
    returns: 'Returns',
    field: 'Field',
    perSpec: 'per the OpenAPI specification',
    resolvedType: 'resolved type',
    openapiSpec: 'OpenAPI spec',
    undocumented: 'Not documented yet.',
  },
  zh: {
    type: '类型',
    default: '默认值',
    optional: '可选',
    see: '参见',
    callbackParams: '回调参数',
    returns: '返回值',
    field: '字段',
    perSpec: '依 OpenAPI 规范',
    resolvedType: '解析类型',
    openapiSpec: 'OpenAPI 规范',
    undocumented: '暂无文档。',
  },
} as const;

function useStrings() {
  const locale = useContext(LocaleContext);
  return STRINGS[locale] ?? STRINGS.en;
}

function Type({ children }: { children: string }) {
  return (
    <code className="rounded bg-fd-muted px-1.5 py-0.5 text-[0.85em]">
      {children}
    </code>
  );
}

function ResolvedShapeTable({ resolved }: { resolved: ResolvedShape }) {
  const s = useStrings();
  const fromScalar = resolved.source === '@scalar/openapi-types';
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-fd-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-fd-border bg-fd-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">{resolved.typeName}</span>
        <span className="text-fd-muted-foreground">
          {fromScalar ? s.perSpec : s.resolvedType}
        </span>
        {resolved.specUrl ? (
          <a
            href={resolved.specUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-fd-primary underline underline-offset-2"
          >
            {s.openapiSpec} ↗
          </a>
        ) : null}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-fd-muted-foreground">
            <th className="px-3 py-2 font-medium">{s.field}</th>
            <th className="px-3 py-2 font-medium">{s.type}</th>
            <th className="px-3 py-2 font-medium">{s.optional}</th>
          </tr>
        </thead>
        <tbody>
          {resolved.fields.map((f) => (
            <tr key={f.name} className="border-t border-fd-border align-top">
              <td className="px-3 py-2 font-mono">{f.name}</td>
              <td className="px-3 py-2">
                <Type>{f.type}</Type>
              </td>
              <td className="px-3 py-2 text-fd-muted-foreground">
                {f.optional ? '✓' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldDetail({
  field,
  hideDescription,
}: {
  field: ConfigField;
  hideDescription?: boolean;
}) {
  const s = useStrings();
  return (
    <div className="not-prose my-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <code className="text-base font-semibold">{field.name}</code>
        {field.optional ? (
          <span className="rounded bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground">
            {s.optional}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-sm">
        <span className="text-fd-muted-foreground">{s.type}: </span>
        <Type>{field.type}</Type>
      </div>
      {field.description && !hideDescription ? (
        <p className="mt-2 text-sm text-fd-foreground/90">{field.description}</p>
      ) : null}
      {field.default ? (
        <p className="mt-1 text-sm">
          <span className="text-fd-muted-foreground">{s.default}: </span>
          <Type>{field.default}</Type>
        </p>
      ) : null}
      {field.see?.length ? (
        <p className="mt-1 text-sm">
          <span className="text-fd-muted-foreground">{s.see}: </span>
          {field.see.map((item, i) => (
            <span key={item}>
              {i > 0 ? ', ' : ''}
              <Type>{item}</Type>
            </span>
          ))}
        </p>
      ) : null}
      {field.callback ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-fd-muted-foreground">
            {s.callbackParams}
          </p>
          {field.callback.params.map((p) => (
            <div
              key={p.name}
              className="mt-2 rounded-lg border border-fd-border p-3"
            >
              <div className="text-sm">
                <code className="font-mono">{p.name}</code>
                <span className="text-fd-muted-foreground">: </span>
                <Type>{p.type}</Type>
              </div>
              {p.resolved ? <ResolvedShapeTable resolved={p.resolved} /> : null}
            </div>
          ))}
          <p className="mt-2 text-sm">
            <span className="text-fd-muted-foreground">{s.returns}: </span>
            <Type>{field.callback.returnType}</Type>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SectionTable({ entry }: { entry: RegistryEntry }) {
  const s = useStrings();
  if (entry.kind !== 'section') return null;
  return (
    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-fd-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-fd-muted-foreground">
            <th className="px-3 py-2 font-medium">{s.field}</th>
            <th className="px-3 py-2 font-medium">{s.type}</th>
            <th className="px-3 py-2 font-medium">{s.default}</th>
            <th className="px-3 py-2 font-medium">{s.type === '类型' ? '说明' : 'Description'}</th>
          </tr>
        </thead>
        <tbody>
          {entry.fields.map((f) => (
            <tr key={f.name} className="border-t border-fd-border align-top">
              <td className="px-3 py-2 font-mono">{f.name}</td>
              <td className="px-3 py-2">
                <Type>{f.type}</Type>
              </td>
              <td className="px-3 py-2 text-fd-muted-foreground">
                {f.default ? <Type>{f.default}</Type> : '—'}
              </td>
              <td className="px-3 py-2 text-fd-foreground/80">
                {f.description ?? (
                  <span className="text-fd-muted-foreground">{s.undocumented}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConfigReference({
  path,
  hideDescription,
}: {
  path: string;
  hideDescription?: boolean;
}) {
  const entry = getEntry(path);
  if (!entry) {
    return (
      <p className="my-4 rounded-lg border border-dashed border-fd-border p-3 text-sm text-fd-muted-foreground">
        No reference data for <code>{path}</code>.
      </p>
    );
  }
  return entry.kind === 'field' ? (
    <FieldDetail field={entry} hideDescription={hideDescription} />
  ) : (
    <SectionTable entry={entry} />
  );
}
