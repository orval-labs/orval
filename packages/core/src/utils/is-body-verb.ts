import { VERBS_WITH_BODY } from '../constants';
import { Verbs } from '../types';

export function getIsBodyVerb(verb: Verbs) {
  return VERBS_WITH_BODY.includes(verb);
}
