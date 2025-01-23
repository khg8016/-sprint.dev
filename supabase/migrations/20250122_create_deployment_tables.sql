-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create deployments table
create table if not exists deployments (
  id uuid primary key default uuid_generate_v4(),
  chat_id text references chats(id),
  subdomain text unique,
  status text,
  netlify_deployment_id text,
  netlify_site_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create deployment_logs table
create table if not exists deployment_logs (
  id uuid primary key default uuid_generate_v4(),
  deployment_id uuid references deployments(id),
  log_type text,
  message text,
  created_at timestamp with time zone default now()
);

-- Create updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for deployments table
create trigger update_deployments_updated_at
  before update on deployments
  for each row
  execute function update_updated_at_column();