export interface GenerateInput {
  schema: string;
  config: string;
}

export interface GenerateOutput {
  content: string;
  filename: string;
}

export interface Example {
  name: string;
  description: string;
  tags: string[];
  config: string;
  schema: string;
}

export interface ExampleCategory {
  label: string;
  options: Array<Example & { selectId: string }>;
}
