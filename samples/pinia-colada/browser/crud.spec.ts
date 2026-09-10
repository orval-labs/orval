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
