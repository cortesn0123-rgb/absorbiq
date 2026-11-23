-- Phase 7.1 review: protect the AI helper's daily request limit.
--
-- The limit counts a user's rows in ai_suggestions. Until now users could delete their own rows,
-- or change their suggestion_date, straight through the Supabase API and so reset the count.
-- Users keep read and insert access; the only change they can make to a row is the `accepted`
-- flag the app sets when a suggested food is logged.

drop policy if exists "Users can delete their own AI suggestions" on public.ai_suggestions;

revoke update on public.ai_suggestions from authenticated, anon;
grant update (accepted) on public.ai_suggestions to authenticated;
