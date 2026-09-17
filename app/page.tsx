import { cookies } from "next/headers";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { DEFAULT_THEME, isTheme, THEME_COOKIE } from "@/lib/theme";

/**
 * Home — Chat (UI_Plan.md §7.2).
 *
 * A thin server shell around one client screen. The theme is read here for the
 * same reason app/layout.tsx reads it: the cookie is what the first paint used,
 * so the header's toggle must be seeded from it rather than from the store.
 */
export default async function ChatPage() {
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  return <ChatScreen theme={theme} />;
}
