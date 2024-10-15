import { Verbs } from '../types';
import { VERBS_WITH_BODY } from '../constants';

export const getIsBodyVerb = (verb: Verbs) => VERBS_WITH_BODY.includes(verb);
