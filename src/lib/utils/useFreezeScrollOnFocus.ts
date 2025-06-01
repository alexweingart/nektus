import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * useFreezeScrollOnFocus – Prevents mobile browsers from auto-scrolling the page
 * when a referenced input element gains focus.
 * 
 * @param ref - React ref object pointing to the input element
 */
export const useFreezeScrollOnFocus = (
  ref: RefObject<HTMLElement | null>
): void => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let savedY = 0;
    const restore = () => window.scrollTo(0, savedY);

    const onFocus = () => {
      savedY = window.scrollY;
      // Restore quickly and again for Safari quirks
      requestAnimationFrame(restore);
      setTimeout(restore, 300);
    };

    el.addEventListener('focus', onFocus, true);
    return () => el.removeEventListener('focus', onFocus, true);
  }, [ref]);
};
