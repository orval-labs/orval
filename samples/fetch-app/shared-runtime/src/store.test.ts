import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vite-plus/test';
import { server } from './mocks/server';
import {
  getListInventoryUrl,
  listInventory,
} from './api/store/inventory/inventory';
import {
  cancelOrder,
  getCancelOrderUrl,
  getGetOrderUrl,
  getOrder,
  getPlaceOrderUrl,
  placeOrder,
} from './api/store/orders/orders';

// The store output goes through the `customFetch` mutator, and is mocked with
// handwritten handlers built from the generated URL builders.
describe('store', () => {
  it('serializes an exploded array query', async () => {
    server.use(
      http.get(getListInventoryUrl(), ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.getAll('status').map((status) => ({
            sku: `sku-${status}`,
            status,
            quantity: 1,
          })),
        ),
      ),
    );

    const res = await listInventory({ status: ['available', 'reserved'] });

    expect(getListInventoryUrl({ status: ['available', 'reserved'] })).toBe(
      'http://localhost:3000/inventory?status=available&status=reserved',
    );
    expect(res.status).toBe(200);
    expect(res.data.map((item) => item.status)).toEqual([
      'available',
      'reserved',
    ]);
  });

  it('sends the header that the mutator adds', async () => {
    let authorization: string | null = null;
    server.use(
      http.post(getPlaceOrderUrl(), async ({ request }) => {
        authorization = request.headers.get('Authorization');
        const order = (await request.json()) as {
          sku: string;
          quantity: number;
        };
        return HttpResponse.json({ id: 1, ...order }, { status: 201 });
      }),
    );

    const res = await placeOrder({ sku: 'sku-1', quantity: 2 });

    expect(authorization).toBe('Bearer sample-token');
    expect(res).toMatchObject({
      status: 201,
      data: { id: 1, sku: 'sku-1', quantity: 2 },
    });
  });

  it('returns a declared error response by status', async () => {
    server.use(
      http.get(getGetOrderUrl(42), () =>
        HttpResponse.json({ message: 'Order 42 not found' }, { status: 404 }),
      ),
    );

    const res = await getOrder(42);

    if (res.status !== 404) throw new Error(`unexpected status ${res.status}`);
    expect(res.data.message).toBe('Order 42 not found');
  });

  it('returns no data for 204', async () => {
    server.use(
      http.delete(
        getCancelOrderUrl(42),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const res = await cancelOrder(42);

    expect(res).toMatchObject({ status: 204, data: undefined });
  });
});
