
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AvatarConfig, User, Message, Position, ChatTarget } from '../types';
import { toast } from 'react-toastify';
import { ROOMS } from '../constants';

// --- STATE ---
interface AppState {
  user: User;
  otherUsers: User[];
  roomMessages: Record<string, Message[]>;
  privateMessages: Record<string, Message[]>;
  globalMessages: Message[];
  activeRoomId: string | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  isVideoOn: boolean;
  isMicOn: boolean;
  interactionTarget: User | null;
  whisperingTo: string | null;
  isCustomizerOpen: boolean;
  isChatOpen: boolean;
  chatTarget: ChatTarget;
}

// --- ACTIONS ---
type Action =
  | { type: 'SET_USER_POSITION'; payload: Position }
  | { type: 'SET_USER_NAME'; payload: string }
  | { type: 'SET_AVATAR'; payload: AvatarConfig }
  | { type: 'SET_ACTIVE_ROOM'; payload: string | null }
  | { type: 'SET_LOCAL_STREAM', payload: MediaStream | null }
  | { type: 'SET_SCREEN_STREAM', payload: MediaStream | null }
  | { type: 'SET_MIC_ON'; payload: boolean }
  | { type: 'SET_VIDEO_ON'; payload: boolean }
  | { type: 'SET_SCREEN_SHARING'; payload: boolean }
  | { type: 'SEND_ROOM_MESSAGE'; payload: { roomId: string; message: Message } }
  | { type: 'SEND_PRIVATE_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'SEND_GLOBAL_MESSAGE'; payload: Message }
  | { type: 'SET_INTERACTION_TARGET'; payload: User | null }
  | { type: 'START_WHISPER'; payload: string | null }
  | { type: 'END_WHISPER' }
  | { type: 'TOGGLE_CUSTOMIZER' }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'SET_CHAT_TARGET'; payload: ChatTarget };

// --- REDUCER ---
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_USER_POSITION':
      return { ...state, user: { ...state.user, position: action.payload } };
    case 'SET_USER_NAME':
       return { ...state, user: { ...state.user, name: action.payload } };
    case 'SET_AVATAR':
      return { ...state, user: { ...state.user, avatar: action.payload } };
    case 'SET_ACTIVE_ROOM':
      if (action.payload === state.activeRoomId) return state;
      // When leaving a room, turn off screen sharing
      if(state.isScreenSharing) {
        state.screenStream?.getTracks().forEach(t => t.stop());
      }
      return { ...state, activeRoomId: action.payload, isScreenSharing: false, screenStream: null, whisperingTo: null };
    case 'SET_LOCAL_STREAM':
      return { ...state, localStream: action.payload };
    case 'SET_SCREEN_STREAM':
      return { ...state, screenStream: action.payload };
    case 'SET_MIC_ON':
        return { ...state, isMicOn: action.payload };
    case 'SET_VIDEO_ON':
        return { ...state, isVideoOn: action.payload };
    case 'SET_SCREEN_SHARING':
        return { ...state, isScreenSharing: action.payload };
    case 'SEND_GLOBAL_MESSAGE':
        return { ...state, globalMessages: [...state.globalMessages, action.payload] };
    case 'SEND_ROOM_MESSAGE': {
      const { roomId, message } = action.payload;
      const roomMessages = state.roomMessages[roomId] || [];
      return {
        ...state,
        roomMessages: { ...state.roomMessages, [roomId]: [...roomMessages, message] },
      };
    }
    case 'SEND_PRIVATE_MESSAGE': {
        const { conversationId, message } = action.payload;
        const conversation = state.privateMessages[conversationId] || [];
        
        let isChatOpen = state.isChatOpen;
        let chatTarget = state.chatTarget;
        // If user is receiving a message and chat isn't open, open it to the sender
        if (message.receiverId === state.user.id && !state.isChatOpen) {
          isChatOpen = true;
          const sender = state.otherUsers.find(u => u.id === message.senderId);
          if (sender) {
            chatTarget = { type: 'private', id: sender.id, name: sender.name };
          }
        }

        return {
          ...state,
          privateMessages: { ...state.privateMessages, [conversationId]: [...conversation, message] },
          isChatOpen,
          chatTarget,
        };
    }
    case 'SET_INTERACTION_TARGET':
      return { ...state, interactionTarget: action.payload };
    case 'START_WHISPER':
        const targetUser = state.otherUsers.find(u => u.id === action.payload);
        if (targetUser) {
            toast.info(`Started whisper call with ${targetUser.name}.`);
        }
        return { ...state, whisperingTo: action.payload, interactionTarget: null };
    case 'END_WHISPER':
        return { ...state, whisperingTo: null };
    case 'TOGGLE_CUSTOMIZER':
        return { ...state, isCustomizerOpen: !state.isCustomizerOpen };
    case 'TOGGLE_CHAT': {
        if (!state.isChatOpen) {
             // Smart chat target logic
            let newTarget: ChatTarget = { type: 'global' };
            if (state.whisperingTo) {
                const whisperUser = state.otherUsers.find(u => u.id === state.whisperingTo);
                if (whisperUser) {
                    newTarget = { type: 'private', id: whisperUser.id, name: whisperUser.name };
                }
            } else if (state.activeRoomId) {
                const room = ROOMS.find(r => r.id === state.activeRoomId);
                if (room) {
                    newTarget = { type: 'room', id: room.id, name: room.name };
                }
            }
            return { ...state, isChatOpen: true, chatTarget: newTarget };
        }
        return { ...state, isChatOpen: false };
    }
    case 'SET_CHAT_TARGET':
        return { ...state, chatTarget: action.payload, isChatOpen: true };
    default:
      return state;
  }
};

// --- LOCAL STORAGE ---
const getInitialUserData = (): {name: string, avatar: AvatarConfig} => {
  try {
    const savedData = localStorage.getItem('virtual-office-user');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (parsed.name && parsed.avatar && parsed.avatar.color) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to parse user data from localStorage', error);
  }
  return { name: 'Guest', avatar: { color: '#3B82F6' } };
};

const getInitialMediaState = (): { isMicOn: boolean, isVideoOn: boolean } => {
    try {
        const savedMic = localStorage.getItem('virtual-office-mic-on');
        const savedVideo = localStorage.getItem('virtual-office-video-on');
        return {
            isMicOn: savedMic ? JSON.parse(savedMic) : false,
            isVideoOn: savedVideo ? JSON.parse(savedVideo) : false,
        };
    } catch (error) {
        console.error('Failed to parse media state from localStorage', error);
    }
    return { isMicOn: false, isVideoOn: false };
}

// --- CONTEXT ---
const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initialUserData = getInitialUserData();
    const initialMediaState = getInitialMediaState();

  const initialState: AppState = {
    user: { id: 'main-user', name: initialUserData.name, position: { x: 500, y: 500 }, avatar: initialUserData.avatar },
    // This simulates another user for demo purposes without a backend.
    otherUsers: [
        { id: 'other-1', name: 'Alice', position: { x: 100, y: 400 }, avatar: { color: '#EF4444' }},
    ],
    roomMessages: {},
    privateMessages: {},
    globalMessages: [],
    activeRoomId: null,
    localStream: null,
    screenStream: null,
    isScreenSharing: false,
    isVideoOn: initialMediaState.isVideoOn,
    isMicOn: initialMediaState.isMicOn,
    interactionTarget: null,
    whisperingTo: null,
    isCustomizerOpen: false,
    isChatOpen: false,
    chatTarget: { type: 'global' },
  };

  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Persist user data
  useEffect(() => {
    const userData = { name: state.user.name, avatar: state.user.avatar };
    localStorage.setItem('virtual-office-user', JSON.stringify(userData));
  }, [state.user.name, state.user.avatar]);

  // Persist media settings
  useEffect(() => {
    localStorage.setItem('virtual-office-mic-on', JSON.stringify(state.isMicOn));
    localStorage.setItem('virtual-office-video-on', JSON.stringify(state.isVideoOn));
  }, [state.isMicOn, state.isVideoOn]);

  // **CRITICAL FIX**: Centralized media stream management
  useEffect(() => {
    // Stop all tracks on the current stream before getting a new one
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }

    if (state.isMicOn || state.isVideoOn) {
      navigator.mediaDevices.getUserMedia({ audio: state.isMicOn, video: state.isVideoOn })
        .then(stream => {
          dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
        })
        .catch(err => {
          console.error("Error accessing media devices.", err);
          toast.error("Camera/Mic access denied.");
          // Turn them back off in the state if permission is denied
          if (state.isMicOn) dispatch({ type: 'SET_MIC_ON', payload: false });
          if (state.isVideoOn) dispatch({ type: 'SET_VIDEO_ON', payload: false });
        });
    } else {
      // If both are off, ensure the stream is null
      dispatch({ type: 'SET_LOCAL_STREAM', payload: null });
    }
  // This effect should ONLY run when the user INTENDS to change mic/video state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isMicOn, state.isVideoOn]);

  // Cleanup screen share stream on unmount or when turned off
  useEffect(() => {
      return () => {
          state.screenStream?.getTracks().forEach(track => track.stop());
      }
  }, [state.screenStream]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};