-- Drop existing unique constraint on subdomain
alter table deployments
drop constraint if exists deployments_subdomain_key;

-- Add new composite unique constraint
alter table deployments
add constraint deployments_chat_id_subdomain_key unique (chat_id, subdomain);