export async function initMocks() {
  if (typeof window === 'undefined') {
    const { server } = await import('./server');
    server.listen();
  } else {
    const { worker } = await import('./browser');
    try {
      await worker.start({
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
        onUnhandledRequest: 'warn',
      });
      console.log('✅ MSW worker started successfully');
    } catch (error) {
      console.error('❌ Failed to start MSW worker:', error);
      throw error;
    }
  }
}
