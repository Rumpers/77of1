-- Auto-versioning triggers for creator_assets (OF-165 / OF-150)
-- On INSERT: create version 1 with snapshot of the new row.
-- On UPDATE: append a new version (version_num = max+1) when storage_path changes.

-- ============================================================
-- Helper: create a version snapshot for an asset row
-- ============================================================
create or replace function _create_asset_version(
  p_asset_id  uuid,
  p_creator_id uuid,
  p_storage_path text,
  p_asset_type   text
) returns void language plpgsql as $$
declare
  v_num integer;
  v_snapshot jsonb;
  v_hash    text;
begin
  -- next version number
  select coalesce(max(version_num), 0) + 1
    into v_num
    from content_versions
   where asset_id = p_asset_id;

  v_snapshot := jsonb_build_object(
    'storage_path', p_storage_path,
    'asset_type',   p_asset_type
  );

  -- SHA-256 of the storage_path string (deterministic content hash proxy)
  v_hash := encode(digest(p_storage_path, 'sha256'), 'hex');

  insert into content_versions
    (asset_id, version_num, content_hash, body_snapshot, created_by)
  values
    (p_asset_id, v_num, v_hash, v_snapshot, p_creator_id);
end;
$$;

-- ============================================================
-- Trigger: auto-create version 1 on asset INSERT
-- ============================================================
create or replace function trg_asset_version_on_insert()
returns trigger language plpgsql as $$
begin
  perform _create_asset_version(
    new.id,
    new.creator_id,
    new.storage_path,
    new.asset_type
  );
  return new;
end;
$$;

drop trigger if exists asset_version_on_insert on creator_assets;
create trigger asset_version_on_insert
  after insert on creator_assets
  for each row execute function trg_asset_version_on_insert();

-- ============================================================
-- Trigger: auto-increment version on asset storage_path UPDATE
-- ============================================================
create or replace function trg_asset_version_on_update()
returns trigger language plpgsql as $$
begin
  -- Only version when content actually changes
  if new.storage_path is distinct from old.storage_path then
    perform _create_asset_version(
      new.id,
      new.creator_id,
      new.storage_path,
      new.asset_type
    );
  end if;
  return new;
end;
$$;

drop trigger if exists asset_version_on_update on creator_assets;
create trigger asset_version_on_update
  after update on creator_assets
  for each row execute function trg_asset_version_on_update();
