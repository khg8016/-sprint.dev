import { map } from 'nanostores';

interface ChatStore {
  id?: string;
  started: boolean;
  aborted: boolean;
  showChat: boolean;
}

export const chatStore = map<ChatStore>({
  started: false,
  aborted: false,
  showChat: true,
});
