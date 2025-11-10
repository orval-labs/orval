import { VERBS_WITH_BODY } from '../constants.ts';
import { Verbs } from '../types.ts';

export const getIsBodyVerb = (verb: Verbs) => VERBS_WITH_BODY.includes(verb);
