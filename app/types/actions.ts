export type ActionType = 'file' | 'shell' | 'deploy';

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

export interface DeployAction extends BaseAction {
  type: 'deploy';
}

// export type SupabaseSubType = 'sql';

/*
 * export interface SupabaseAction extends BaseAction {
 *   type: 'supabase';
 *   subType: SupabaseSubType;
 * }
 */

export type BoltAction = FileAction | ShellAction | StartAction | DeployAction;

export type BoltActionData = BoltAction | BaseAction;

export interface ActionAlert {
  type: string;
  title: string;
  description: string;
  content: string;
  source?: 'terminal' | 'preview'; // Add source to differentiate between terminal and preview errors
}
