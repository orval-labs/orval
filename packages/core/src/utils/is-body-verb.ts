import { VERBS_WITH_BODY } from '../constants';
import { Verbs } from '../types';

export const getIsBodyVerb = (verb: Verbs) => VERBS_WITH_BODY.includes(verb);
