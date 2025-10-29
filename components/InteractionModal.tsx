
import React from 'react';
import { useAppContext } from '../context/AppContext';
import { User } from '../types';
import { CloseIcon, PhoneIcon, ChatBubbleIcon } from './Icons';

interface InteractionModalProps {
    targetUser: User;
}

const InteractionModal: React.FC<InteractionModalProps> = ({ targetUser }) => {
    const { dispatch } = useAppContext();

    const handleClose = () => {
        dispatch({ type: 'SET_INTERACTION_TARGET', payload: null });
    };

    const handleWhisper = () => {
        dispatch({ type: 'START_WHISPER', payload: targetUser.id });
    };

    const handleChat = () => {
        dispatch({ type: 'SET_CHAT_TARGET', payload: { type: 'private', id: targetUser.id, name: targetUser.name } });
        dispatch({ type: 'SET_INTERACTION_TARGET', payload: null }); // Close modal after action
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleClose}
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-xs relative border border-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={handleClose} className="absolute top-3 right-3 text-gray-400 hover:text-white">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold mb-4 text-center">Interact with {targetUser.name}</h2>
                <div className="flex flex-col space-y-3">
                    <button 
                        onClick={handleWhisper}
                        className="flex items-center justify-center w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        <PhoneIcon className="w-5 h-5 mr-2" />
                        Whisper (Audio)
                    </button>
                    <button 
                        onClick={handleChat}
                        className="flex items-center justify-center w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        <ChatBubbleIcon className="w-5 h-5 mr-2" />
                        Chat (Text)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InteractionModal;