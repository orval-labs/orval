import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [
    {
      name: 'synthetic-pet-api',
      configureServer(server) {
        let nextId = 3;
        const pets = new Map([
          [1, { id: 1, name: 'Milo' }],
          [2, { id: 2, name: 'Luna' }],
        ]);
        server.middlewares.use('/api', async (req, res, next) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          if (!url.pathname.startsWith('/pets')) return next();
          const id = Number(url.pathname.split('/')[2]);
          let text = '';
          for await (const chunk of req) text += chunk;
          const body = text
            ? (JSON.parse(text) as { name: string })
            : undefined;
          await new Promise((resolve) => setTimeout(resolve, 150));
          res.setHeader('Content-Type', 'application/json');
          if (body?.name === 'error') {
            res.statusCode = 500;
            return res.end(JSON.stringify({ message: 'Synthetic failure' }));
          }
          if (req.method === 'GET') {
            const result = id
              ? pets.get(id)
              : [...pets.values()].filter((pet) =>
                  pet.name
                    .toLowerCase()
                    .includes(
                      (url.searchParams.get('search') ?? '').toLowerCase(),
                    ),
                );
            res.statusCode = result ? 200 : 404;
            return res.end(JSON.stringify(result ?? { message: 'Not found' }));
          }
          if (req.method === 'DELETE') {
            pets.delete(id);
            res.statusCode = 204;
            return res.end();
          }
          const pet = {
            id: req.method === 'POST' ? nextId++ : id,
            name: body?.name ?? '',
          };
          pets.set(pet.id, pet);
          res.end(JSON.stringify(pet));
        });
      },
    },
  ],
});
