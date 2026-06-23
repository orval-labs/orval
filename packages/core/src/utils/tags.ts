import { DefaultTag } from '../types';
import { kebab } from './case';

/**
 * Canonical bucket key for a single OpenAPI tag.
 *
 * In `tags` / `tags-split` mode operations are routed into files by their first
 * tag. This function is the **single source of truth** for turning a tag (or a
 * missing tag) into the key that identifies that file bucket. Every place that
 * groups operations by tag, derives a per-tag file/directory name, or checks
 * whether an operation belongs to a tag MUST go through here so that the
 * "build the key" side and the "look the key up" side can never disagree.
 *
 * The result is `kebab`-cased. `kebab` is idempotent
 * (`kebab(kebab(x)) === kebab(x)`), so it is always safe to call this on a value
 * that is already a canonical key. Other case functions (`camel`, `pascal`) are
 * NOT safe here: they do not round-trip through the bucket key for tags
 * containing acronyms or spaces (e.g. `"AB Widget"`), which is exactly the class
 * of bug this module exists to prevent.
 *
 * Missing or empty tags map to the implicit {@link DefaultTag} bucket.
 */
export function getTagKey(tag?: string): string {
  const normalizedTag = tag?.trim();
  return kebab(normalizedTag ? normalizedTag : DefaultTag);
}

/**
 * Canonical bucket key for an operation, derived from its primary (first) tag.
 *
 * Untagged operations resolve to the {@link DefaultTag} bucket.
 */
export function getOperationTagKey(operation: { tags: string[] }): string {
  return getTagKey(operation.tags[0]);
}

/**
 * Whether an operation belongs to the given tag bucket.
 *
 * Both sides are normalised through {@link getTagKey}, so the comparison is
 * correct regardless of how `tagKey` was spelled or cased by the caller. An
 * absent (`undefined`) `tagKey` matches every operation (the "no tag filter"
 * case); an empty/whitespace `tagKey` is normalised to the {@link DefaultTag}
 * bucket like any other tag.
 *
 * Prefer this over hand-rolling `operation.tags[0] === tagKey`: a raw tag
 * compared against a canonical key silently fails for multi-word/acronym tags.
 */
export function isOperationInTagBucket(
  operation: { tags: string[] },
  tagKey?: string,
): boolean {
  if (tagKey == null) return true;
  return getOperationTagKey(operation) === getTagKey(tagKey);
}
