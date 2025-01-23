-- Drop all unique constraints from deployments table
alter table deployments
drop constraint if exists deployments_subdomain_key;

alter table deployments
drop constraint if exists deployments_chat_id_subdomain_key;