export type ActionType = 'file' | 'shell' | 'supabase';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface StartAction extends BaseAction {
  type: 'start';
}

export type SupabaseSubType = 'storage' | 'sql';

export interface SupabaseAction extends BaseAction {
  type: 'supabase';
  subType: SupabaseSubType;
}

export type BoltAction = FileAction | ShellAction | StartAction | SupabaseAction;

export type BoltActionData = BoltAction | BaseAction;

export interface ActionAlert {
  type: string;
  title: string;
  description: string;
  content: string;
  source?: 'terminal' | 'preview'; // Add source to differentiate between terminal and preview errors
}
