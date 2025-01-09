/**
 * Generated by orval v7.4.1 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */

// based on https://github.com/honojs/middleware/blob/main/packages/zod-validator/src/index.ts
import type { z, ZodSchema, ZodError } from 'zod';
import {
  Context,
  Env,
  Input,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from 'hono';

type HasUndefined<T> = undefined extends T ? true : false;

type Hook<T, E extends Env, P extends string, O = {}> = (
  result:
    | { success: true; data: T }
    | { success: false; error: ZodError; data: T },
  c: Context<E, P>,
) =>
  | Response
  | Promise<Response>
  | void
  | Promise<Response | void>
  | TypedResponse<O>;
import { zValidator as zValidatorBase } from '@hono/zod-validator';

type ValidationTargetsWithResponse = ValidationTargets & { response: any };

export const zValidator =
  <
    T extends ZodSchema,
    Target extends keyof ValidationTargetsWithResponse,
    E extends Env,
    P extends string,
    In = z.input<T>,
    Out = z.output<T>,
    I extends Input = {
      in: HasUndefined<In> extends true
        ? {
            [K in Target]?: K extends 'json'
              ? In
              : HasUndefined<
                    keyof ValidationTargetsWithResponse[K]
                  > extends true
                ? { [K2 in keyof In]?: ValidationTargetsWithResponse[K][K2] }
                : { [K2 in keyof In]: ValidationTargetsWithResponse[K][K2] };
          }
        : {
            [K in Target]: K extends 'json'
              ? In
              : HasUndefined<
                    keyof ValidationTargetsWithResponse[K]
                  > extends true
                ? { [K2 in keyof In]?: ValidationTargetsWithResponse[K][K2] }
                : { [K2 in keyof In]: ValidationTargetsWithResponse[K][K2] };
          };
      out: { [K in Target]: Out };
    },
    V extends I = I,
  >(
    target: Target,
    schema: T,
    hook?: Hook<z.infer<T>, E, P>,
  ): MiddlewareHandler<E, P, V> =>
  async (c, next) => {
    if (target !== 'response') {
      const value = await zValidatorBase<
        T,
        keyof ValidationTargets,
        E,
        P,
        In,
        Out,
        I,
        V
      >(
        target,
        schema,
        hook,
      )(c, next);

      if (value instanceof Response) {
        return value;
      }
    } else {
      await next();

      if (
        c.res.status !== 200 ||
        !c.res.headers.get('Content-Type')?.includes('application/json')
      ) {
        return;
      }

      let value: unknown;
      try {
        value = await c.res.json();
      } catch {
        const message = 'Malformed JSON in response';
        c.res = new Response(message, { status: 400 });

        return;
      }

      const result = await schema.safeParseAsync(value);

      if (hook) {
        const hookResult = hook({ data: value, ...result }, c);
        if (hookResult) {
          if (hookResult instanceof Response || hookResult instanceof Promise) {
            const hookResponse = await hookResult;

            if (hookResponse instanceof Response) {
              c.res = new Response(hookResponse.body, hookResponse);
            }
          }
          if (
            'response' in hookResult &&
            hookResult.response instanceof Response
          ) {
            c.res = new Response(hookResult.response.body, hookResult.response);
          }
        }
      }

      if (!result.success) {
        c.res = new Response(JSON.stringify(result), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        c.res = new Response(JSON.stringify(result.data), c.res);
      }
    }
  };
