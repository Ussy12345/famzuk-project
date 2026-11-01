create or replace function is_admin() returns boolean language sql security definer as $$ select coalesce((select is_admin from profiles where id=auth.uid()),false) $$;
create policy admin_courses on course_profiles for all using(is_admin()) with check(is_admin());
create policy admin_templates on chapter_templates for all using(is_admin()) with check(is_admin());
-- To make yourself admin: update profiles set is_admin=true where id='<your user id>';
