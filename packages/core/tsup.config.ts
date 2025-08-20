import { defineConfig } from 'tsup';
import { baseOptions } from '../tsup.base';

export default defineConfig({ ...baseOptions, target: 'node16' });
