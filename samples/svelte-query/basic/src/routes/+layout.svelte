<script>
  import { onMount } from 'svelte';
  import '../app.css';

  onMount(() => {
    void import('../mocks/browser').then(({ worker }) =>
      worker.start({ onUnhandledRequest: 'bypass' }).catch(console.warn),
    );
  });
</script>

<slot />
