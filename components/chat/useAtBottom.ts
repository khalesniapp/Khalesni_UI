"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Whether the reader is following the bottom of the page — UI_Plan.md §7.2.5.
 *
 * Lifted out of `Thread` because the "Jump to latest" pill has to render inside
 * the sticky composer block rather than in the scrolling thread: a pill
 * positioned against the viewport bottom lands *on top of* the composer, and
 * the composer's height changes as the textarea grows, so no fixed offset fixes
 * it. Both the thread (which decides whether to follow new messages) and the
 * composer block (which draws the pill) need the answer, so it lives here.
 */

/** §7.2.5: within 80 px of the bottom counts as "following". */
export const PIN_THRESHOLD_PX = 80;

export function useAtBottom(): { atBottom: boolean; scrollToBottom: (smooth?: boolean) => void } {
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    function onScroll() {
      const distance =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setAtBottom(distance <= PIN_THRESHOLD_PX);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    // A growing composer or an expanding card changes the answer without any
    // scrolling happening at all.
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  return { atBottom, scrollToBottom };
}
