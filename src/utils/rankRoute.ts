const segmentize = (uri: string) => {
  return uri
    .replace(/(^\/+|\/+$)/g, '') // strip starting/ending slashes
    .split('/');
};

const paramRe = /^:(.+)/;

const SEGMENT_POINTS = 4;
const STATIC_POINTS = 3;
const DYNAMIC_POINTS = 2;
const SPLAT_PENALTY = 1;
const ROOT_POINTS = 1;

const isRootSegment = (segment: string) => segment === '';
const isDynamic = (segment: string) => paramRe.test(segment);
const isSplat = (segment: string) => segment && segment[0] === '*';

/**
 * Returns a score for a path, higher score means higher "specificity"
 * @see https://reach.tech/router/ranking
 * @param path - the path with path parameters and wildcards
 * @return the ranking score
 */
export const rankRoute = (path: string) => {
  return segmentize(path).reduce((score, segment) => {
    score += SEGMENT_POINTS;
    if (isRootSegment(segment)) score += ROOT_POINTS;
    else if (isDynamic(segment)) score += DYNAMIC_POINTS;
    else if (isSplat(segment)) score -= SEGMENT_POINTS + SPLAT_PENALTY;
    else score += STATIC_POINTS;
    return score;
  }, 0);
};
