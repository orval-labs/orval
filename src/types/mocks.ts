export interface MockDefinition {
  value: string | string[] | { [key: string]: MockDefinition };
  enums?: string[];
  imports: string[];
  name: string;
}
