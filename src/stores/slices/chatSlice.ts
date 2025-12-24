import { StateCreator } from 'zustand';

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
    sources?: any[];
}

export interface ChatSlice {
    chatMessages: ChatMessage[];
    addChatMessage: (message: { role: 'user' | 'model'; text: string; sources?: any[] }) => void;
    setChatMessages: (messages: ChatMessage[]) => void;
    clearChatMessages: () => void;

    // Pending query from other UI
    pendingChatQuery: string;
    setPendingChatQuery: (query: string) => void;
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
    chatMessages: [],
    addChatMessage: (message) => set((state) => ({
        chatMessages: [...state.chatMessages, {
            id: Date.now().toString() + Math.random(),
            ...message,
            timestamp: Date.now()
        }]
    })),
    setChatMessages: (messages) => set({ chatMessages: messages }),
    clearChatMessages: () => set({ chatMessages: [] }),

    pendingChatQuery: '',
    setPendingChatQuery: (pendingChatQuery) => set({ pendingChatQuery }),
});
