-- Checklists become fully editable: member+ (the same people who create them)
-- can rename or delete a checklist and edit or delete its items.
-- Only the text columns are writable; ticking stays in toggle_item(), which
-- keeps completed_at in step.

create policy "member update" on public.task_checklists for update to authenticated
    using (private.has_role(private.task_project(task_id), 'member'))
    with check (private.has_role(private.task_project(task_id), 'member'));
create policy "member delete" on public.task_checklists for delete to authenticated
    using (private.has_role(private.task_project(task_id), 'member'));

create policy "member update" on public.task_checklist_items for update to authenticated
    using (private.has_role(private.checklist_project(checklist_id), 'member'))
    with check (private.has_role(private.checklist_project(checklist_id), 'member'));
create policy "member delete" on public.task_checklist_items for delete to authenticated
    using (private.has_role(private.checklist_project(checklist_id), 'member'));

revoke update on public.task_checklists, public.task_checklist_items from authenticated, anon;
grant update (title) on public.task_checklists to authenticated;
grant update (content) on public.task_checklist_items to authenticated;
