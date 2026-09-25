import type {
  ChartTemplateParameter,
  Query,
  StoryAvailableBenchmarksData,
  Tag,
} from '../generated/default/openapi-3.0-nullable-ref-enum/model';

const tagWithNullGroup: Tag = { group: null };
const tagWithoutGroup: Tag = {};
const parameterWithNullDefault: ChartTemplateParameter = { default: null };
const dataWithNullDate: StoryAvailableBenchmarksData = { default_date: null };
const queryWithNullBranches: Query = {
  benchmark_config: null,
  order_by: null,
};

void tagWithNullGroup;
void tagWithoutGroup;
void parameterWithNullDefault;
void dataWithNullDate;
void queryWithNullBranches;
