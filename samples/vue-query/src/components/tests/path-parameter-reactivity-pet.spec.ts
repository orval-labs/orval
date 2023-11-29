import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, screen, waitFor } from '@testing-library/vue';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../mocks/server';
import Pet from './path-parameter-reactivity-pet.vue';

describe('Path parameters reactivity', () => {
  it('works', async () => {
    server.use(
      http.get('*/v:version/pets/:petId', ({ params }) => {
        return new Response(
          JSON.stringify({
            id: params.petId,
            name: params.petId === '123' ? 'Cat 123' : 'Dog not 123',
          }),
        );
      }),
    );

    render(Pet, {
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
  }, 10000);
});
