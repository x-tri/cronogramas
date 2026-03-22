-- RPC function to resolve school names (bypasses RLS on schools table)
-- Needed because the anon key cannot read the schools table directly
CREATE OR REPLACE FUNCTION get_school_names(school_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.id, s.name
  FROM schools s
  WHERE s.id = ANY(school_ids);
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION get_school_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_names(uuid[]) TO anon;
