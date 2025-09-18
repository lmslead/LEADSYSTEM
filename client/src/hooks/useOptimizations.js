import { useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Custom hook for memoizing expensive computations
 * @param {Function} computeFunction - The computation function
 * @param {Array} deps - Dependencies array
 * @returns {any} The memoized result
 */
export const useOptimizedMemo = (computeFunction, deps) => {
  return useMemo(computeFunction, deps);
};

/**
 * Custom hook for memoizing callback functions
 * @param {Function} callback - The callback function
 * @param {Array} deps - Dependencies array
 * @returns {Function} The memoized callback
 */
export const useOptimizedCallback = (callback, deps) => {
  return useCallback(callback, deps);
};

/**
 * Custom hook for preventing unnecessary re-renders by tracking previous props
 * @param {Object} props - The props object to compare
 * @returns {boolean} True if props have changed
 */
export const usePropsChanged = (props) => {
  const prevProps = useRef();
  
  useEffect(() => {
    prevProps.current = props;
  });

  if (!prevProps.current) {
    return true;
  }

  const keys = Object.keys(props);
  const prevKeys = Object.keys(prevProps.current);

  if (keys.length !== prevKeys.length) {
    return true;
  }

  for (let key of keys) {
    if (props[key] !== prevProps.current[key]) {
      return true;
    }
  }

  return false;
};

/**
 * Custom hook for throttling function calls
 * @param {Function} func - The function to throttle
 * @param {number} limit - The throttle limit in milliseconds
 * @returns {Function} The throttled function
 */
export const useThrottle = (func, limit) => {
  const inThrottle = useRef(false);
  const lastFunc = useRef();
  const lastRan = useRef();

  return useCallback((...args) => {
    if (!inThrottle.current) {
      func(...args);
      lastRan.current = Date.now();
      inThrottle.current = true;
      setTimeout(() => {
        inThrottle.current = false;
      }, limit);
    } else {
      clearTimeout(lastFunc.current);
      lastFunc.current = setTimeout(() => {
        if (Date.now() - lastRan.current >= limit) {
          func(...args);
          lastRan.current = Date.now();
        }
      }, limit - (Date.now() - lastRan.current));
    }
  }, [func, limit]);
};