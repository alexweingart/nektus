import { useEffect } from 'react';

/**
 * useFreezeScrollOnFocus – Prevents mobile browsers from auto-scrolling the page
 * when a referenced input element gains focus.
 */
export const useFreezeScrollOnFocus = (
  ref: React.RefObject<HTMLElement>
) => {
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

    el.addEventListener('focus', onFocus);
    return () => el.removeEventListener('focus', onFocus);
  }, [ref]);
};
