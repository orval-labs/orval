import { VERBS_WITH_BODY } from '../constants.ts';
import { Verbs } from '../types.ts';

export function getIsBodyVerb(verb: Verbs) {
  return VERBS_WITH_BODY.includes(verb);
}
