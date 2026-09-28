import type * as zod from 'zod';

import type {
  WidgetDetails,
  WidgetDetailsOutput,
} from '../generated/fetch/issue-4226/model';
import type { GetWidgetResponse as GetWidgetResponseMini } from '../generated/zod/issue-4226-mini/endpoints';
import type {
  GetShapesResponseItem,
  GetWidgetResponse,
} from '../generated/zod/issue-4226/endpoints';

// `namingConvention.properties` renames keys through a transform: the schema
// input keeps the spec's (wire) keys and the output carries the converted
// names (#4226).
type WidgetIn = zod.input<typeof GetWidgetResponse>;
type WidgetOut = zod.output<typeof GetWidgetResponse>;

const wire: WidgetIn = {
  widget_id: 'w1',
  display_name: 'Widget',
  tag_list: [{ tag_name: 'a' }],
};
const out: WidgetOut = {
  widgetId: 'w1',
  displayName: 'Widget',
  tagList: [{ tagName: 'a' }],
  pagingOptions: { pageSize: 20 },
  class: 'x',
};
// @ts-expect-error the output no longer has the wire key
const wireKeyInOutput: WidgetOut['widget_id'] = 'w1';

const miniOut: zod.output<typeof GetWidgetResponseMini> = out;

// Optional keys stay optional in the output.
const minimal: WidgetOut = { widgetId: 'w1', displayName: 'Widget' };

// Each discriminated union branch is renamed too.
const circle: zod.output<typeof GetShapesResponseItem> = {
  shapeType: 'circle',
  radiusPx: 1,
};

// The fetch client sends the wire-shaped input and returns the output.
const body: WidgetDetails = {
  widget_id: 'w1',
  display_name: 'Widget',
  owner_id: 'o1',
};
const details: WidgetDetailsOutput = {
  widgetId: 'w1',
  displayName: 'Widget',
  ownerId: 'o1',
};

void wire;
void wireKeyInOutput;
void miniOut;
void minimal;
void circle;
void body;
void details;
