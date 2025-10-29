
import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChatTarget, Message } from '../types';
import { ROOMS } from '../constants';
import Linkify from './Linkify';
import { CloseIcon } from './Icons';

const notificationSound = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDVFVVNFUgAAACgAAAAwMDFlNmZmYi05MmI5LTQzYTYtYjU4MC0wMGRhNTk0YjI0MWEAWENNAAAACQAAABhNVVNJQ01BVEhJMQAA//MUxAAAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV-y/";

const UnifiedChat: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { user, chatTarget, roomMessages, privateMessages, globalMessages, otherUsers } = state;
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const lastPrivateMessageCount = useRef(0);

    const getMessages = (): Message[] => {
        switch (chatTarget.type) {
            case 'global':
                return globalMessages;
            case 'room':
                return roomMessages[chatTarget.id] || [];
            case 'private':
                const conversationId = [user.id, chatTarget.id].sort().join('-');
                return privateMessages[conversationId] || [];
            default:
                return [];
        }
    };

    const messages = getMessages();

    useEffect(() => {
        // Play sound for new incoming private messages
        if (chatTarget.type === 'private') {
            const currentMessageCount = messages.length;
            if (currentMessageCount > lastPrivateMessageCount.current && messages[currentMessageCount - 1]?.senderId !== user.id) {
                audioRef.current?.play().catch(e => console.error("Error playing sound:", e));
            }
            lastPrivateMessageCount.current = currentMessageCount;
        }
    }, [messages, user.id, chatTarget]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;
        
        const baseMessage = {
            id: Date.now().toString(),
            senderId: user.id,
            userName: user.name,
            text: newMessage,
            timestamp: Date.now(),
        };

        switch (chatTarget.type) {
            case 'global':
                dispatch({ type: 'SEND_GLOBAL_MESSAGE', payload: { ...baseMessage, receiverId: 'global' } });
                break;
            case 'room':
                dispatch({ type: 'SEND_ROOM_MESSAGE', payload: { roomId: chatTarget.id, message: { ...baseMessage, receiverId: 'everyone' } } });
                break;
            case 'private':
                const conversationId = [user.id, chatTarget.id].sort().join('-');
                dispatch({ type: 'SEND_PRIVATE_MESSAGE', payload: { conversationId, message: { ...baseMessage, receiverId: chatTarget.id } } });
                break;
        }

        setNewMessage('');
    };

    const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const [type, id] = value.split(':');

        if (type === 'global') {
            dispatch({ type: 'SET_CHAT_TARGET', payload: { type: 'global' } });
        } else if (type === 'room') {
            const room = ROOMS.find(r => r.id === id);
            if (room) {
                dispatch({ type: 'SET_CHAT_TARGET', payload: { type: 'room', id: room.id, name: room.name } });
            }
        } else if (type === 'private') {
            const targetUser = otherUsers.find(u => u.id === id);
            if (targetUser) {
                dispatch({ type: 'SET_CHAT_TARGET', payload: { type: 'private', id: targetUser.id, name: targetUser.name } });
            }
        }
    };

    const getTargetValue = (target: ChatTarget) => {
        if (target.type === 'global') return 'global:all';
        return `${target.type}:${target.id}`;
    };

    const getHeader = (target: ChatTarget) => {
        if (target.type === 'global') return 'Open Space Chat';
        if (target.type === 'room') return `${target.name} Chat`;
        return `Chat with ${target.name}`;
    }

    return (
        <div className="absolute bottom-20 right-4 w-80 md:w-96 h-[300px] md:h-[400px] bg-gray-900 bg-opacity-90 backdrop-blur-sm rounded-lg shadow-2xl z-20 flex flex-col border border-gray-700">
            <div className="flex justify-between items-center text-md font-bold p-3 bg-gray-800 rounded-t-lg">
                <h3>{getHeader(chatTarget)}</h3>
                <button onClick={() => dispatch({ type: 'TOGGLE_CHAT' })} className="text-gray-400 hover:text-white">
                    <CloseIcon className="w-5 h-5"/>
                </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto">
                {messages.map(msg => (
                    <div key={msg.id} className={`mb-2 ${msg.senderId === user.id ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-2 rounded-lg max-w-[80%] ${msg.senderId === user.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                            <div className="text-xs font-bold text-gray-400 mb-1">{msg.userName}</div>
                            <p className="text-sm break-words"><Linkify text={msg.text} /></p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-700">
                <select 
                    value={getTargetValue(chatTarget)}
                    onChange={handleTargetChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 mb-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="global:all">Open Space (Global)</option>
                    <optgroup label="Rooms">
                        {ROOMS.map(room => (
                            <option key={room.id} value={`room:${room.id}`}>{room.name}</option>
                        ))}
                    </optgroup>
                     <optgroup label="Users">
                        {otherUsers.map(u => (
                            <option key={u.id} value={`private:${u.id}`}>{u.name}</option>
                        ))}
                    </optgroup>
                </select>
                <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                />
            </form>
            <audio ref={audioRef} src={notificationSound} preload="auto" />
        </div>
    );
};

export default UnifiedChat;