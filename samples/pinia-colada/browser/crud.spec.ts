import { test, expect } from '@playwright/test';

test('generated CRUD mutations refresh queries and recover from errors', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '1: Milo', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '2: Luna', exact: true }).click();
  await expect(page.getByTestId('detail')).toContainText('Luna');
  await page.getByLabel('Name', { exact: true }).fill('Nova');
  await page.getByRole('button', { name: 'Create pet', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '3: Nova', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Moon');
  await page
    .getByRole('button', { name: 'Update selected pet', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '2: Moon', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('detail')).toContainText('Moon');
  await page.getByRole('button', { name: 'Delete Nova', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '3: Nova', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill('error');
  await page.getByRole('button', { name: 'Create pet', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Request failed. Try another name.',
  );
  await page.getByLabel('Name', { exact: true }).fill('Sunny');
  await page.getByRole('button', { name: 'Create pet', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '4: Sunny', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Search', { exact: true }).fill('Sunny');
  await expect(
    page.getByRole('button', { name: '1: Milo', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '4: Sunny', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/english-crud.png',
    fullPage: true,
  });
});

test('Fetch, Axios and custom transports preserve mutation payloads and HTTP errors', async ({
  page,
}) => {
  const calls: {
    method: string;
    url: string;
    body: string;
    contentType: string;
  }[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const body = request.postData() ?? '';
    calls.push({
      method: request.method(),
      url: request.url(),
      body,
      contentType: request.headers()['content-type'] ?? '',
    });
    const status = body.includes('error')
      ? 500
      : request.method() === 'DELETE' || request.url().endsWith('/ping')
        ? 204
        : 200;
    await route.fulfill({
      status,
      contentType: 'application/json',
      body:
        status === 204
          ? ''
          : JSON.stringify(
              request.url().endsWith('/pets') && request.method() === 'GET'
                ? []
                : { id: 8, name: 'Checked' },
            ),
    });
  });
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const results: boolean[] = [];
    for (const transport of ['fetch-single', 'axios-single', 'custom']) {
      const api = await import(`/src/gen/${transport}/client.ts`);
      const created = await api
        .getCreatePetMutationOptions()
        .mutation({ createPetBody: { name: 'Checked' } }, {});
      results.push(
        (transport === 'axios-single' ? created.data : created).id === 8,
      );
      await api.replacePet(8, { name: 'Replacement' });
      await api.submitForm({ name: 'Form value' });
      await api.uploadPet({
        file: new Blob(['image bytes'], { type: 'image/png' }),
      });
      await api.deletePet(8);
      await api.ping();
      try {
        await api
          .getCreatePetMutationOptions()
          .mutation({ createPetBody: { name: 'error' } }, {});
        results.push(false);
      } catch {
        results.push(true);
      }
    }
    return results;
  });
  expect(results).toEqual([true, true, true, true, true, true]);
  expect(
    calls.filter(
      (call) => call.method === 'PUT' && call.body.includes('Replacement'),
    ),
  ).toHaveLength(3);
  expect(
    calls.filter(
      (call) =>
        call.url.endsWith('/form') &&
        call.contentType.includes('application/x-www-form-urlencoded') &&
        call.body.includes('Form'),
    ),
  ).toHaveLength(3);
  expect(
    calls.filter(
      (call) =>
        call.url.endsWith('/upload') &&
        call.contentType.includes('multipart/form-data') &&
        call.body.includes('image bytes'),
    ),
  ).toHaveLength(3);
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(3);
});
