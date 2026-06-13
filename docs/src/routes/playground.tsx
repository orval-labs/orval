import { createFileRoute } from '@tanstack/react-router';

import {
  getPlaygroundHead,
  PlaygroundPage as PlaygroundScreen,
} from '@/components/playground/playground-page';

export const Route = createFileRoute('/playground')({
  head: () => getPlaygroundHead('en'),
  component: PlaygroundRoutePage,
});

function PlaygroundRoutePage() {
  return <PlaygroundScreen locale="en" />;
}
