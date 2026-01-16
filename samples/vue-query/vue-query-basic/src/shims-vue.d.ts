declare module '*.vue' {
  import { DefineComponent } from 'vue';
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
