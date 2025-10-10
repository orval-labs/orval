export const throttle = (func, limit) => {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      func(...args); //exec function
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit); //release throttle after limit time
    }
  };
};

/** The throttle function is used to limit how often a given function can be executed, ensuring it only runs once every specified interval.

In the original implementation, this was aliased and used with func.apply(context, args). However, with the transition to Next.js 15 and stricter ESM behavior, this in module scope is undefined by default — which led to a linting error: Unexpected aliasing of 'this' to local variable.

Since no usage of the throttle function relied on this, I refactored the code to use an arrow function instead, removing the need for this and preserving the intended behavior. */
