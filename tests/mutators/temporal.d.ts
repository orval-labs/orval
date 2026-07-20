/**
 * Minimal ambient declarations for the Temporal API (TC39 Stage 3).
 *
 * TypeScript does not yet ship Temporal types (as of TS 5.9). This stub
 * provides just enough surface for the formatType test configs that
 * reference Temporal.PlainDate and Temporal.Instant in generated code.
 *
 * Remove this file once TypeScript includes Temporal in its lib types.
 * Check: if `lib: ["esnext"]` resolves `Temporal.PlainDate`, this file
 * is no longer needed.
 */
declare namespace Temporal {
  class PlainDate {
    static from(item: string): PlainDate;
    toString(): string;
  }
  class Instant {
    static from(item: string): Instant;
    toString(): string;
  }
}
