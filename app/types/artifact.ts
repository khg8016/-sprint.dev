export interface FileMap {
  [path: string]: {
    type: 'file' | 'folder';
    content?: string;
    isBinary: boolean;
  };
}

export interface BoltArtifactData {
  id: string;
  title: string;
  type?: string | undefined;
}
