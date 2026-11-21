/** Validates the body of POST /api/helper (untrusted). */

import { ValidationError } from "@/lib/logs/validate";
import type { ChatTurn } from "./helper";

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_HISTORY_TURNS = 12;
export const MAX_TURN_LENGTH = 4000;
/** Requests per user per day (counted from the ai_suggestions table). */
export const DAILY_REQUEST_LIMIT = 30;

export interface HelperBody {
  message: string;
  history: ChatTurn[];
}

export function parseHelperBody(raw: unknown): HelperBody {
  if (typeof raw !== "object" || raw === null) throw new ValidationError("Invalid request.");
  const { message, history } = raw as Record<string, unknown>;
  if (typeof message !== "string" || !message.trim()) {
    throw new ValidationError("Type a request.");
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(`Keep requests under ${MAX_MESSAGE_LENGTH} characters.`);
  }
  const turns = history ?? [];
  if (!Array.isArray(turns)) throw new ValidationError("Invalid chat history.");
  return {
    message: message.trim(),
    history: turns.slice(-MAX_HISTORY_TURNS).map((t): ChatTurn => {
      const turn = (typeof t === "object" && t !== null ? t : {}) as Record<string, unknown>;
      if (
        (turn.role !== "user" && turn.role !== "assistant") ||
        typeof turn.text !== "string" ||
        turn.text.length > MAX_TURN_LENGTH
      ) {
        throw new ValidationError("Invalid chat history.");
      }
      return { role: turn.role, text: turn.text };
    }),
  };
}
