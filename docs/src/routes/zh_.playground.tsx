import { createFileRoute } from '@tanstack/react-router';

import {
  getPlaygroundHead,
  PlaygroundPage as PlaygroundScreen,
} from '@/components/playground/playground-page';

export const Route = createFileRoute('/zh_/playground')({
  head: () => getPlaygroundHead('zh'),
  component: ZhPlaygroundPage,
});

function ZhPlaygroundPage() {
  return <PlaygroundScreen locale="zh" />;
}
