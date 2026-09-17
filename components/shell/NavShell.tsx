import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

/**
 * The application shell — UI_Plan.md §4, §14.
 *
 * Content column: full width below 768 px, 640 px centred to 1023 px, 760 px
 * beside the sidebar from 1024 px up. The main element is the scroll container
 * so the bottom bar stays put and `state-preservation` has something to
 * restore.
 */
export function NavShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-160 px-(--space-4) lg:max-w-190">
            {children}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
