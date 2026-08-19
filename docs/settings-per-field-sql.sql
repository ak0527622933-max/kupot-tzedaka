alter table app_settings add column if not exists org_name_updated_at timestamptz;
alter table app_settings add column if not exists currency_updated_at timestamptz;
alter table app_settings add column if not exists reminder_days_updated_at timestamptz;
