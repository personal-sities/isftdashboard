create index if not exists lms_students_campus_study_section_status_idx
on public.lms_students (campus, study_form_context, section, status);

create index if not exists lms_students_sync_key_idx
on public.lms_students (sync_key);

create index if not exists lms_payments_campus_study_payment_date_idx
on public.lms_payments (campus, study_form_context, payment_date);

create index if not exists lms_payments_synced_at_idx
on public.lms_payments (synced_at);

create or replace view public.lms_students_summary as
select
  campus,
  study_form_context,
  count(*) filter (where status = 10) as aktiv_talabalar,
  count(*) filter (where status = 1) as chetlashtirilganlar,
  count(*) filter (where status = 2) as akademik_tatil,
  count(*) filter (where status = 5) as akademik_mobillik,
  count(*) filter (where status = 4) as bitirganlar,
  count(*) filter (where section = 'bekor_qilinganlar') as bekor_qilinganlar,
  count(*) as jami
from public.lms_students
group by campus, study_form_context;

create or replace view public.lms_payments_summary as
select
  campus,
  study_form_context,
  count(*) as tolovlar_soni,
  coalesce(sum(amount), 0) as jami_tolov_summa,
  min(payment_date) as eng_eski_tolov,
  max(payment_date) as eng_yangi_tolov
from public.lms_payments
group by campus, study_form_context;

create or replace view public.lms_students_course_direction_summary as
select
  campus,
  study_form_context,
  coalesce(course, 'Noma''lum') as course,
  coalesce(direction, 'Noma''lum') as direction,
  count(*) filter (where status = 10) as aktiv_talabalar,
  count(*) as jami_talabalar
from public.lms_students
group by campus, study_form_context, coalesce(course, 'Noma''lum'), coalesce(direction, 'Noma''lum');

create or replace view public.lms_payments_course_direction_summary as
with latest_students as (
  select distinct on (user_id)
    user_id,
    campus,
    study_form_context,
    coalesce(course, 'Noma''lum') as course,
    coalesce(direction, 'Noma''lum') as direction,
    synced_at,
    id
  from public.lms_students
  where user_id is not null
  order by user_id, synced_at desc nulls last, id desc
)
select
  ls.campus,
  ls.study_form_context,
  ls.course,
  ls.direction,
  count(*) as tolovlar_soni,
  coalesce(sum(p.amount), 0) as jami_tolov_summa
from public.lms_payments p
join latest_students ls on ls.user_id = p.user_id
group by ls.campus, ls.study_form_context, ls.course, ls.direction;

grant select on public.lms_students_summary to authenticated;
grant select on public.lms_payments_summary to authenticated;
grant select on public.lms_students_course_direction_summary to authenticated;
grant select on public.lms_payments_course_direction_summary to authenticated;

comment on view public.lms_students_summary is 'LMS dashboard summary view for fast frontend reads.';
comment on view public.lms_payments_summary is 'LMS payments dashboard summary view for fast frontend reads.';
comment on view public.lms_students_course_direction_summary is 'LMS students summary grouped by course and direction.';
comment on view public.lms_payments_course_direction_summary is 'LMS payments summary grouped by joined student course and direction.';

-- Productionda anon uchun read access tavsiya qilinmaydi.
grant select on public.lms_students_summary to anon;
grant select on public.lms_payments_summary to anon;
grant select on public.lms_students_course_direction_summary to anon;
grant select on public.lms_payments_course_direction_summary to anon;
