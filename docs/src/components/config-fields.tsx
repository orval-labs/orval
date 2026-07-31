import type {
  ConfigField,
  ConfigSection,
  ResolvedShape,
} from "@/generated/config-reference/types";

function Type({ children }: { children: string }) {
  return (
    <code className="rounded bg-fd-muted px-1.5 py-0.5 text-[0.85em]">
      {children}
    </code>
  );
}

function ResolvedShapeTable({ resolved }: { resolved: ResolvedShape }) {
  const fromScalar = resolved.source === "@scalar/openapi-types";
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-fd-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-fd-border bg-fd-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">{resolved.typeName}</span>
        <span className="text-fd-muted-foreground">
          {fromScalar ? "per the OpenAPI specification" : "resolved type"}
        </span>
        {resolved.specUrl ? (
          <a
            href={resolved.specUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-fd-primary underline underline-offset-2"
          >
            OpenAPI spec ↗
          </a>
        ) : null}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-fd-muted-foreground">
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Optional</th>
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
                {f.optional ? "yes" : "no"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldDoc({ field }: { field: ConfigField }) {
  return (
    <div className="not-prose my-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <code className="text-base font-semibold">{field.name}</code>
        {field.optional ? (
          <span className="rounded bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground">
            optional
          </span>
        ) : null}
      </div>
      <div className="mt-1">
        <span className="text-fd-muted-foreground">Type: </span>
        <Type>{field.type}</Type>
      </div>
      {field.description ? (
        <p className="mt-2 text-sm text-fd-foreground/90">
          {field.description}
        </p>
      ) : null}
      {field.default ? (
        <p className="mt-1 text-sm">
          <span className="text-fd-muted-foreground">Default: </span>
          <Type>{field.default}</Type>
        </p>
      ) : null}
      {field.see?.length ? (
        <p className="mt-1 text-sm">
          <span className="text-fd-muted-foreground">See: </span>
          {field.see.map((s, i) => (
            <span key={s}>
              {i > 0 ? ", " : ""}
              <Type>{s}</Type>
            </span>
          ))}
        </p>
      ) : null}
      {field.callback ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-fd-muted-foreground">
            Callback parameters
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
            <span className="text-fd-muted-foreground">Returns: </span>
            <Type>{field.callback.returnType}</Type>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ConfigFields({
  section,
  name,
}: {
  section: ConfigSection;
  name?: string;
}) {
  const fields = name
    ? section.fields.filter((f) => f.name === name)
    : section.fields;
  return (
    <>
      {fields.map((f) => (
        <FieldDoc key={f.name} field={f} />
      ))}
    </>
  );
}
