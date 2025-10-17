if (typeof window === 'undefined') {
  import('./server').then(({ server }) =>
    server.listen({ onUnhandledRequest: 'bypass' }),
  );
} else {
  import('./browser').then(({ worker }) =>
    worker.start({ onUnhandledRequest: 'bypass' }).catch(console.warn),
  );
}
