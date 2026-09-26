import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vite-plus/test';

import { findUp, findUpMultiple } from './find-up';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-find-up-'));
const leaf = path.join(root, 'a', 'b', 'c');
fs.mkdirSync(leaf, { recursive: true });
fs.writeFileSync(path.join(root, 'package.json'), '{}');
fs.writeFileSync(path.join(root, 'a', 'package.json'), '{}');
fs.writeFileSync(path.join(root, 'a', 'b', 'jsconfig.json'), '{}');
fs.mkdirSync(path.join(leaf, 'tsconfig.json')); // a directory, not a file

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('findUpMultiple', () => {
  it('returns one file per directory, nearest first', () => {
    expect(findUpMultiple('package.json', leaf)).toEqual([
      path.join(root, 'a', 'package.json'),
      path.join(root, 'package.json'),
    ]);
  });

  it('tries names in order per directory and skips directories', () => {
    expect(findUp(['tsconfig.json', 'jsconfig.json'], leaf)).toBe(
      path.join(root, 'a', 'b', 'jsconfig.json'),
    );
  });

  it('is undefined / empty when nothing matches', () => {
    expect(findUp('nope.json', leaf)).toBeUndefined();
    expect(findUpMultiple('nope.json', leaf)).toEqual([]);
  });
});
