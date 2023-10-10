import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, screen, waitFor } from '@testing-library/vue';
import { rest } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import Pet from './pet.vue';
import Pet2 from './pet2.vue';

describe('Path parameters reactivity', () => {
  [
    { name: 'pet', component: Pet }, // params=computed({...}) case
    // { name: 'pet2', component: Pet2 }, // TODO: fix params={petId: computed} case?
  ].map(({ name, component }) =>
    it(`${name} works`, async () => {
      server.use(
        rest.get('*/v:version/pets/:petId', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              id: req.params.petId,
              name: req.params.petId === '123' ? 'Cat 123' : 'Dog not 123',
            }),
          );
        }),
      );

      render(component, {
        props: {
          petId: '5',
        },
        global: {
          plugins: [VueQueryPlugin],
        },
      });

      // console.log(screen.debug());

      // check that only dog is rendered
      await waitFor(() => {
        expect(screen.getAllByText('Dog not 123')).toHaveLength(1);
        expect(screen.queryByText('Cat 123')).toBeNull();
      });

      // console.log(screen.debug());

      // check that only cat is rendered
      await waitFor(
        () => {
          expect(screen.getAllByText('Cat 123')).toHaveLength(1);
          expect(screen.queryByText('Dog not 123')).toBeNull();
        },
        {
          timeout: 5000,
        },
      );

      // console.log(screen.debug());
    }, 10000),
  );
});
