if (typeof window === 'undefined') {
	import('./server').then(({ server }) => server.listen());
} else {
	import('./browser').then(({ worker }) => worker.start());
}
