import { createApp, defineComponent, h, ref } from 'vue';
import { createPinia } from 'pinia';
import { PiniaColada, useQueryCache } from '@pinia/colada';
import {
  getListPetsQueryKey,
  useCreatePet,
  useDeletePet,
  useGetPet,
  useListPets,
  useUpdatePet,
} from './gen/fetch-single/client';
import './style.css';

const App = defineComponent({
  setup() {
    const cache = useQueryCache();
    const selectedId = ref(1);
    const name = ref('New pet');
    const search = ref('');
    const notice = ref('');
    const list = useListPets(() => ({ search: search.value }), {
      query: { staleTime: 60_000 },
    });
    const detail = useGetPet(selectedId);
    const refreshList = () =>
      cache.invalidateQueries({ key: getListPetsQueryKey().slice(0, 2) });
    const mutation = {
      onSuccess: async () => {
        notice.value = 'Saved successfully';
        await refreshList();
      },
      onError: () => {
        notice.value = 'Request failed. Try another name.';
      },
    };
    const create = useCreatePet({ mutation });
    const update = useUpdatePet({ mutation });
    const remove = useDeletePet({ mutation });
    const busy = () =>
      [create, update, remove].some(
        (item) => item.asyncStatus.value === 'loading',
      );
    return () =>
      h('main', [
        h('h1', 'Orval + Pinia Colada'),
        h(
          'p',
          'Generated, typed queries and mutations. All data in this demo is synthetic.',
        ),
        h('section', [
          h('h2', 'Pets'),
          h('label', [
            'Search',
            h('input', {
              'aria-label': 'Search',
              value: search.value,
              onInput: (event: Event) => {
                search.value = (event.target as HTMLInputElement).value;
              },
            }),
          ]),
          h('button', { onClick: () => list.refetch() }, 'Refresh list'),
          list.asyncStatus.value === 'loading' ? h('p', 'Loading pets…') : null,
          list.error.value
            ? h('p', { role: 'alert' }, 'Could not load pets')
            : null,
          h(
            'ul',
            { 'data-testid': 'pets' },
            (list.data.value ?? []).map((pet) =>
              h('li', { key: pet.id }, [
                h(
                  'button',
                  {
                    onClick: () => {
                      selectedId.value = pet.id;
                    },
                  },
                  `${pet.id}: ${pet.name}`,
                ),
                h(
                  'button',
                  {
                    disabled: busy(),
                    onClick: () => remove.mutate({ petId: pet.id }),
                  },
                  `Delete ${pet.name}`,
                ),
              ]),
            ),
          ),
        ]),
        h('section', [
          h('h2', 'Create or update'),
          h('label', [
            'Name',
            h('input', {
              'aria-label': 'Name',
              value: name.value,
              onInput: (event: Event) => {
                name.value = (event.target as HTMLInputElement).value;
              },
            }),
          ]),
          h(
            'button',
            {
              disabled: busy(),
              onClick: () =>
                create.mutate({ createPetBody: { name: name.value } }),
            },
            'Create pet',
          ),
          h(
            'button',
            {
              disabled: busy(),
              onClick: () =>
                update.mutate({
                  petId: selectedId.value,
                  updatePetBody: { name: name.value },
                }),
            },
            'Update selected pet',
          ),
          h('p', 'Use the name "error" to test failure and recovery.'),
          h('p', { role: 'status' }, busy() ? 'Saving…' : notice.value),
        ]),
        h('section', [
          h('h2', `Selected pet ${selectedId.value}`),
          h(
            'pre',
            { 'data-testid': 'detail' },
            detail.error.value
              ? 'Could not load pet'
              : JSON.stringify(detail.data.value, null, 2),
          ),
          h('button', { onClick: () => detail.refetch() }, 'Refresh details'),
        ]),
      ]);
  },
});

createApp(App).use(createPinia()).use(PiniaColada).mount('#app');
