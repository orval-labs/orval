import type { Tag as NativeEnumTag } from '../generated/default/openapi-3.0-nullable-ref-enum-native-enums/model';
import { QueryOrderBy as NativeEnumQueryOrderBy } from '../generated/default/openapi-3.0-nullable-ref-enum-native-enums/model';
import type {
  ChartTemplateParameter,
  Query,
  StoryAvailableBenchmarksData,
  Tag,
} from '../generated/default/openapi-3.0-nullable-ref-enum/model';
import { QueryOrderBy } from '../generated/default/openapi-3.0-nullable-ref-enum/model';

const tagWithNullGroup: Tag = { group: null };
const tagWithoutGroup: Tag = {};
const tagWithNullBranches: Tag = {
  parent_group: null,
  retired_label: null,
  retired_on: null,
  visibility: null,
};
const tagWithVisibility: Tag = { visibility: 'public' };
const nativeEnumTagWithNullVisibility: NativeEnumTag = { visibility: null };
const parameterWithNullDefault: ChartTemplateParameter = { default: null };
const dataWithNullDate: StoryAvailableBenchmarksData = { default_date: null };
const queryWithNullBranches: Query = {
  benchmark_config: null,
  order_by: null,
};
const queryWithOrderBy: Query = { order_by: QueryOrderBy.name };
const orderByValues: string[] = Object.values(QueryOrderBy);
const nativeEnumOrderByValues: string[] = Object.values(NativeEnumQueryOrderBy);

void tagWithNullGroup;
void tagWithoutGroup;
void tagWithNullBranches;
void tagWithVisibility;
void nativeEnumTagWithNullVisibility;
void parameterWithNullDefault;
void dataWithNullDate;
void queryWithNullBranches;
void queryWithOrderBy;
void orderByValues;
void nativeEnumOrderByValues;
