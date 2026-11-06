/*
# Store username from sign-up metadata on profile creation

## What this does
New users now get their chosen username saved in their profile when they sign up.
Until now the profile trigger only copied id and email, so `username` stayed empty
and the friend search by name could not find new users.

## Modified objects
- `handle_new_user()` (trigger function on auth.users): reads `username` from the
  sign-up metadata. If that name is not yet taken it is stored; otherwise the
  username stays empty and the user can choose another one in Settings.

## Security
- No table, column, grant or policy changes.
- The function stays SECURITY DEFINER with a fixed search_path.

## Important Notes
1. Existing profiles are not changed.
2. Name validation (length, allowed characters) happens in the app before sign-up.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username text;
BEGIN
  requested_username := NULLIF(NEW.raw_user_meta_data->>'username', '');

  IF requested_username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE username = requested_username
  ) THEN
    requested_username := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, requested_username)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
