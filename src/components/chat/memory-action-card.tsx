import { MemorySaveConfirmCard } from "@/components/chat/memory-save-confirm-card";
import { MemorySavedCard } from "@/components/chat/memory-saved-card";
import { MemoryUpdateConfirmCard } from "@/components/chat/memory-update-confirm-card";
import type { ChatAction } from "@/lib/ai/provider";

/**
 * Dispatches one Memory ChatAction to its card, by kind. Deliberately thin —
 * all rendering and form logic lives in the three card components; this only
 * routes. `conversationId` is only meaningful to memory_save_confirm (a
 * confirmed save records its originating conversation, same as an automatic
 * one); the other two kinds ignore it.
 */
export function MemoryActionCard({
  action,
  conversationId,
}: {
  action: ChatAction;
  conversationId: string | null;
}) {
  switch (action.kind) {
    case "memory_saved":
      return <MemorySavedCard action={action} />;
    case "memory_save_confirm":
      return <MemorySaveConfirmCard action={action} conversationId={conversationId} />;
    case "memory_update_confirm":
      return <MemoryUpdateConfirmCard action={action} />;
    default:
      return null;
  }
}
