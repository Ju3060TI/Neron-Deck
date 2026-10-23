/*
# Fix security warnings on trigger functions

1. Lock the search_path on touch_updated_at (was mutable).
2. Revoke EXECUTE on handle_new_user from anon and authenticated so it
   can only be invoked by the database trigger, not via the REST API.
*/

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
