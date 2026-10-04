import { useEffect } from 'react';

/** Sets the browser tab title, which screen readers announce on navigation. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} \u00b7 GlowLogic`;
  }, [title]);
}
