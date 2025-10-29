
import React from 'react';
import { useAppContext } from '../context/AppContext';
import { AvatarIcon, MicOnIcon, MicOffIcon, VideoOnIcon, VideoOffIcon, ChatBubbleLeftRightIcon, ScreenShareIcon } from './Icons';
import { toast } from 'react-toastify';

const ControlBar: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { isMicOn, isVideoOn, isScreenSharing, screenStream } = state;

    const toggleGlobalMic = () => {
        dispatch({ type: 'SET_MIC_ON', payload: !isMicOn });
    };

    const toggleGlobalVideo = () => {
        dispatch({ type: 'SET_VIDEO_ON', payload: !isVideoOn });
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            screenStream?.getTracks().forEach(track => track.stop());
            dispatch({ type: 'SET_SCREEN_STREAM', payload: null });
            dispatch({ type: 'SET_SCREEN_SHARING', payload: false });
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                stream.getVideoTracks()[0].onended = () => {
                    dispatch({ type: 'SET_SCREEN_STREAM', payload: null });
                    dispatch({ type: 'SET_SCREEN_SHARING', payload: false });
                };
                dispatch({ type: 'SET_SCREEN_STREAM', payload: stream });
                dispatch({ type: 'SET_SCREEN_SHARING', payload: true });
            } catch (err) {
                toast.error("Could not start screen sharing.");
                console.error(err);
            }
        }
    };


    return (
        <footer className="w-full bg-gray-900 p-2 shadow-lg z-30 border-t border-gray-700 flex items-center justify-center space-x-4 flex-shrink-0 h-16">
            <button 
                onClick={toggleGlobalMic} 
                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"} 
                className={`p-3 rounded-full shadow-lg transition-colors transform hover:scale-110 ${isMicOn ? 'bg-blue-600' : 'bg-red-600'}`}
            >
                {isMicOn ? <MicOnIcon className="w-6 h-6"/> : <MicOffIcon className="w-6 h-6"/>}
            </button>
            <button 
                onClick={toggleGlobalVideo} 
                title={isVideoOn ? "Turn Off Camera" : "Turn On Camera"} 
                className={`p-3 rounded-full shadow-lg transition-colors transform hover:scale-110 ${isVideoOn ? 'bg-blue-600' : 'bg-red-600'}`}
            >
                {isVideoOn ? <VideoOnIcon className="w-6 h-6"/> : <VideoOffIcon className="w-6 h-6"/>}
            </button>
            <button 
                onClick={toggleScreenShare} 
                title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
                className={`p-3 rounded-full shadow-lg transition-colors transform hover:scale-110 ${isScreenSharing ? 'bg-green-600' : 'bg-gray-600'}`}
            >
                <ScreenShareIcon className="w-6 h-6"/>
            </button>
            <div className="h-full border-l border-gray-700 mx-2"></div>
             <button 
                onClick={() => dispatch({ type: 'TOGGLE_CHAT' })} 
                title="Open Chat" 
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold p-3 rounded-full shadow-lg transition-transform transform hover:scale-110"
            >
                <ChatBubbleLeftRightIcon className="w-6 h-6"/>
            </button>
            <button 
                onClick={() => dispatch({ type: 'TOGGLE_CUSTOMIZER' })} 
                title="Customize Avatar" 
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold p-3 rounded-full shadow-lg transition-transform transform hover:scale-110"
            >
                <AvatarIcon className="w-6 h-6"/>
            </button>
        </footer>
    );
};

export default ControlBar;
