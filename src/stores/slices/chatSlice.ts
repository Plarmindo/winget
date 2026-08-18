import { StateCreator } from 'zustand';
import { ChatMessage } from '../../types';

export type { ChatMessage };

export interface ChatSlice {
  chatMessages: ChatMessage[];
  addChatMessage: (message: {
    role: 'user' | 'model';
    text: string;
    sources?: { uri: string; title: string }[];
  }) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  clearChatMessages: () => void;

  // Pending query from other UI
  pendingChatQuery: string;
  setPendingChatQuery: (query: string) => void;
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  chatMessages: [],
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          id: crypto.randomUUID(),
          ...message,
          timestamp: Date.now(),
        },
      ],
    })),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  clearChatMessages: () => set({ chatMessages: [] }),

  pendingChatQuery: '',
  setPendingChatQuery: (pendingChatQuery) => set({ pendingChatQuery }),
});
