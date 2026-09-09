import { styleText } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { ErrorWithTag, type OrvalReporter } from '../types';
import {
  bindReporter,
  consoleReporter,
  createLogger,
  createSuccessMessage,
  getLogLevel,
  getProjectName,
  getWarningCount,
  logger,
  noopReporter,
  resetWarnings,
  resolveLogLevel,
  setLogLevel,
  setProjectName,
  withReporter,
} from './logger';

const createSpyReporter = () => {
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const verbose = vi.fn();
  const debug = vi.fn();
  const reporter: OrvalReporter = { info, warn, error, verbose, debug };
  return { info, warn, error, verbose, debug, reporter };
};

describe('logger', () => {
  afterEach(() => {
    resetWarnings();
    setLogLevel('info');
    setProjectName();
    vi.restoreAllMocks();
  });

  it('increments and resets the warning count even with noopReporter', () => {
    expect(getWarningCount()).toBe(0);
    logger.warn('test warning');
    expect(getWarningCount()).toBe(1);
    logger.warn('another warning');
    expect(getWarningCount()).toBe(2);
    resetWarnings();
    expect(getWarningCount()).toBe(0);
  });

  it('is a no-op outside a reporter scope', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('@orval/core');

    logger.info('hidden');
    logger.warn('hidden');
    logger.error('hidden');

    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('sets the project name without a callback wrap', () => {
    const { info, reporter } = createSpyReporter();
    const logger = createLogger('orval');

    withReporter(reporter, () => {
      setProjectName('petstore');
      logger.info('Cleaning output folder');
    });

    expect(getProjectName()).toBeUndefined();
    expect(info).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - Cleaning output folder`,
      packageName: 'orval',
      projectName: 'petstore',
    });
  });

  it('isolates bindReporter across sequential setProjectName calls', () => {
    const first = createSpyReporter();
    const second = createSpyReporter();
    const logger = createLogger('orval');
    let restoreFirst: ReturnType<typeof bindReporter> | undefined;
    let restoreSecond: ReturnType<typeof bindReporter> | undefined;

    withReporter(first.reporter, () => {
      setProjectName('a');
      restoreFirst = bindReporter();
    });
    withReporter(second.reporter, () => {
      setProjectName('b');
      restoreSecond = bindReporter();
    });

    restoreFirst?.(() => {
      logger.info('hello');
    });
    restoreSecond?.(() => {
      logger.info('hello');
    });

    expect(first.info).toHaveBeenCalledWith({
      message: `${styleText('green', 'a')} - hello`,
      packageName: 'orval',
      projectName: 'a',
    });
    expect(second.info).toHaveBeenCalledWith({
      message: `${styleText('green', 'b')} - hello`,
      packageName: 'orval',
      projectName: 'b',
    });
  });

  it('dispatches structured events with package and project metadata', async () => {
    const { info, warn, reporter } = createSpyReporter();
    const logger = createLogger('@orval/effect');

    await withReporter(reporter, async () => {
      await withReporter({ projectName: 'petstore' }, async () => {
        await Promise.resolve();
        logger.info('Cleaning output folder');
        logger.warn('Skipped a symlink');
      });
    });

    expect(info).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - Cleaning output folder`,
      packageName: '@orval/effect',
      projectName: 'petstore',
    });
    expect(warn).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - ${styleText(
        'yellow',
        '⚠️  Skipped a symlink',
      )}`,
      packageName: '@orval/effect',
      projectName: 'petstore',
    });
  });

  it('formats errors into a deterministic message', () => {
    const { error, reporter } = createSpyReporter();
    const cause = new Error('missing file');

    withReporter(reporter, () => {
      withReporter({ projectName: 'petstore' }, () => {
        logger.error(new Error('generation failed', { cause }));
      });
    });

    expect(error).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - ${styleText(
        'red',
        '🛑 generation failed\n  Cause: missing file',
      )}`,
      packageName: '@orval/core',
      projectName: 'petstore',
    });
  });

  it('formats ErrorWithTag from the cause and tag', () => {
    const { error, reporter } = createSpyReporter();
    const cause = new Error('missing file');

    withReporter(reporter, () => {
      logger.error(new ErrorWithTag('wrapped', 'import', { cause }));
    });

    expect(error).toHaveBeenCalledWith({
      message: styleText('red', '🛑 import - missing file'),
      packageName: '@orval/core',
      projectName: undefined,
    });
  });

  it('formats warnings the same way as errors', () => {
    const { warn, reporter } = createSpyReporter();
    const cause = new Error('missing file');

    withReporter(reporter, () => {
      logger.warn(
        new Error('format failed', { cause }),
        'Failed to format file',
      );
    });

    expect(warn).toHaveBeenCalledWith({
      message: styleText(
        'yellow',
        '⚠️  Failed to format file - format failed\n  Cause: missing file',
      ),
      packageName: '@orval/core',
      projectName: undefined,
    });
  });

  it('accepts an optional tag on logger.error', () => {
    const { error, reporter } = createSpyReporter();

    withReporter(reporter, () => {
      logger.error(new Error('boom'), 'Failed to run afterAllFilesWrite hook');
    });

    expect(error).toHaveBeenCalledWith({
      message: styleText(
        'red',
        '🛑 Failed to run afterAllFilesWrite hook - boom',
      ),
      packageName: '@orval/core',
      projectName: undefined,
    });
  });

  it('keeps styled console output when consoleReporter is selected', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    withReporter(consoleReporter, () => {
      withReporter({ projectName: 'petstore' }, () => {
        logger.warn('test warning');
        logger.info('Cleaning output folder');
      });
    });

    expect(consoleLog).toHaveBeenCalledWith(
      `${styleText('green', 'petstore')} - ${styleText(
        'yellow',
        '⚠️  test warning',
      )}`,
    );
    expect(consoleLog).toHaveBeenCalledWith(
      `${styleText('green', 'petstore')} - Cleaning output folder`,
    );
  });

  it('builds a styled success message', () => {
    expect(createSuccessMessage('Petstore')).toBe(
      `🎉 ${styleText('green', 'Petstore')} - Your OpenAPI spec has been converted into ready to use orval!`,
    );
    expect(createSuccessMessage()).toBe(
      '🎉 Your OpenAPI spec has been converted into ready to use orval!',
    );
  });

  it('prefixes all messages with the package name when log level is verbose', () => {
    const { info, warn, error, verbose, reporter } = createSpyReporter();
    const logger = createLogger('@orval/zod');

    setLogLevel('verbose');
    withReporter(reporter, () => {
      setProjectName('petstore');
      logger.info('Cleaning output folder');
      logger.warn('Skipped a symlink');
      logger.error('generation failed');
      logger.verbose('inlining $ref');
    });

    const prefix = `${styleText('green', 'petstore')} - [@orval/zod] - `;
    expect(info).toHaveBeenCalledWith({
      message: `${prefix}Cleaning output folder`,
      packageName: '@orval/zod',
      projectName: 'petstore',
    });
    expect(warn).toHaveBeenCalledWith({
      message: `${prefix}${styleText('yellow', '⚠️  Skipped a symlink')}`,
      packageName: '@orval/zod',
      projectName: 'petstore',
    });
    expect(error).toHaveBeenCalledWith({
      message: `${prefix}${styleText('red', '🛑 generation failed')}`,
      packageName: '@orval/zod',
      projectName: 'petstore',
    });
    expect(verbose).toHaveBeenCalledWith({
      message: `${prefix}inlining $ref`,
      packageName: '@orval/zod',
      projectName: 'petstore',
    });
  });

  it('defaults to the info log level', () => {
    expect(getLogLevel()).toBe('info');
  });

  it('gates messages by log level', () => {
    const { info, warn, verbose, debug, reporter } = createSpyReporter();
    const logger = createLogger('@orval/zod');

    withReporter(reporter, () => {
      logger.verbose('hidden');
      logger.debug('hidden');
    });
    expect(verbose).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();

    setLogLevel('verbose');
    withReporter(reporter, () => {
      logger.verbose('visible');
      logger.debug('still hidden');
    });
    expect(verbose).toHaveBeenCalledWith({
      message: '[@orval/zod] - visible',
      packageName: '@orval/zod',
      projectName: undefined,
    });
    expect(debug).not.toHaveBeenCalled();

    setLogLevel('warn');
    withReporter(reporter, () => {
      logger.info('hidden');
      logger.warn('visible');
    });
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith({
      message: expect.stringContaining('visible'),
      packageName: '@orval/zod',
      projectName: undefined,
    });

    setLogLevel('error');
    withReporter(reporter, () => {
      logger.info('hidden');
      logger.warn('counted');
    });
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(getWarningCount()).toBe(2);

    setLogLevel('debug');
    withReporter(reporter, () => {
      logger.debug('visible');
    });
    expect(debug).toHaveBeenCalledWith({
      message: '[@orval/zod] - visible',
      packageName: '@orval/zod',
      projectName: undefined,
    });
  });

  it('isolates nested and concurrent reporter scopes', async () => {
    const first = createSpyReporter();
    const second = createSpyReporter();
    const logger = createLogger('orval');

    await Promise.all([
      withReporter(first.reporter, async () => {
        await withReporter({ projectName: 'a' }, async () => {
          await Promise.resolve();
          logger.info('hello');
        });
      }),
      withReporter(second.reporter, async () => {
        await withReporter({ projectName: 'b' }, async () => {
          await Promise.resolve();
          logger.info('hello');
        });
      }),
    ]);

    expect(first.info).toHaveBeenCalledWith({
      message: `${styleText('green', 'a')} - hello`,
      packageName: 'orval',
      projectName: 'a',
    });
    expect(second.info).toHaveBeenCalledWith({
      message: `${styleText('green', 'b')} - hello`,
      packageName: 'orval',
      projectName: 'b',
    });
    expect(first.info).toHaveBeenCalledTimes(1);
    expect(second.info).toHaveBeenCalledTimes(1);
  });

  it('lets an outer reporter win when ifUnset is set', () => {
    const outer = createSpyReporter();
    const inner = createSpyReporter();
    const logger = createLogger('orval');

    withReporter(outer.reporter, () => {
      withReporter({ reporter: inner.reporter, ifUnset: true }, () => {
        logger.info('kept outer');
      });
    });

    expect(outer.info).toHaveBeenCalledWith({
      message: 'kept outer',
      packageName: 'orval',
      projectName: undefined,
    });
    expect(inner.info).not.toHaveBeenCalled();
  });

  it('does not treat an implicit noop from setProjectName as an installed reporter', () => {
    const inner = createSpyReporter();
    const logger = createLogger('orval');

    setProjectName('petstore');
    withReporter({ reporter: inner.reporter, ifUnset: true }, () => {
      logger.info('installed');
    });

    expect(inner.info).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - installed`,
      packageName: 'orval',
      projectName: 'petstore',
    });
  });

  it('does not treat a projectName-only scope as an installed reporter', () => {
    const inner = createSpyReporter();
    const logger = createLogger('orval');

    withReporter({ projectName: 'petstore' }, () => {
      withReporter({ reporter: inner.reporter, ifUnset: true }, () => {
        logger.info('installed');
      });
    });

    expect(inner.info).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - installed`,
      packageName: 'orval',
      projectName: 'petstore',
    });
  });

  it('keeps an explicit noopReporter when ifUnset is set', () => {
    const inner = createSpyReporter();
    const logger = createLogger('orval');

    withReporter(noopReporter, () => {
      withReporter({ reporter: inner.reporter, ifUnset: true }, () => {
        logger.info('should stay silent');
      });
    });

    expect(inner.info).not.toHaveBeenCalled();
  });

  it('keeps projectName when a reporter is spread with scope fields', () => {
    const { info, reporter } = createSpyReporter();
    const logger = createLogger('orval');

    withReporter({ ...reporter, projectName: 'petstore' }, () => {
      logger.info('hello');
    });

    expect(info).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - hello`,
      packageName: 'orval',
      projectName: 'petstore',
    });
  });

  it('resolves CLI log-level flags', () => {
    expect(resolveLogLevel({})).toBe('info');
    expect(resolveLogLevel({ verbose: true })).toBe('verbose');
    expect(resolveLogLevel({ quiet: true })).toBe('warn');
    expect(resolveLogLevel({ logLevel: 'debug' })).toBe('debug');
  });

  it('does not increment the warning count twice for logger.warn', () => {
    withReporter(noopReporter, () => {
      logger.warn('once');
    });
    expect(getWarningCount()).toBe(1);
  });

  it('re-enters the captured scope from later callbacks', async () => {
    const { info, reporter } = createSpyReporter();
    const logger = createLogger('orval');
    let restore: ReturnType<typeof bindReporter> | undefined;

    withReporter(reporter, () => {
      withReporter({ projectName: 'petstore' }, () => {
        restore = bindReporter();
      });
    });

    await Promise.resolve();
    restore?.(() => {
      logger.info('from watcher');
    });

    expect(info).toHaveBeenCalledWith({
      message: `${styleText('green', 'petstore')} - from watcher`,
      packageName: 'orval',
      projectName: 'petstore',
    });
  });
});
