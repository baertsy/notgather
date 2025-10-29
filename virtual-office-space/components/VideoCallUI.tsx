
import React, { useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Room, User } from '../types';
import { VideoOffIcon, ZoomInIcon } from './Icons';
import { toast } from 'react-toastify';

interface VideoStream {
    id: string;
    name: string;
    stream: MediaStream;
    isMuted?: boolean;
    isScreen?: boolean;
}

const VideoPlayer = ({ videoStream }: { videoStream: VideoStream }) => {
    const { state } = useAppContext();
    const { isVideoOn, isScreenSharing } = state;
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { stream, isMuted, name, isScreen } = videoStream;

    React.useEffect(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
    }, [stream]);
    
    const handleFullScreen = () => {
      if(containerRef.current) {
          if (document.fullscreenElement) {
              document.exitFullscreen();
          } else {
              containerRef.current.requestFullscreen().catch(err => {
                  toast.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
              });
          }
      }
    }
    
    // Show video if it's a screen share OR if the main video is on.
    const showVideo = isScreen ? isScreenSharing : isVideoOn;

    return (
        <div ref={containerRef} className="bg-gray-700 aspect-video rounded-md flex items-center justify-center relative border-2 overflow-hidden group border-gray-600 h-full">
            { showVideo ? (
                <video ref={videoRef} autoPlay playsInline muted={isMuted} className={`w-full h-full object-contain bg-black ${isScreen ? '' : 'scale-x-[-1]'}`}></video>
            ) : (
                <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center">
                    <span className="font-bold text-gray-400 text-sm">{name}</span>
                    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center"><VideoOffIcon className="w-8 h-8 text-white"/></div>
                </div>
            )}
            <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 px-2 py-0.5 text-xs rounded">{name}</div>
            <button onClick={handleFullScreen} className="absolute top-1 right-1 bg-black bg-opacity-50 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Toggle Fullscreen">
                <ZoomInIcon className="w-5 h-5"/>
            </button>
        </div>
    );
};


const VideoCallUI: React.FC<{ room: Room }> = ({ room }) => {
  const { state } = useAppContext();
  const { isScreenSharing, localStream, screenStream, user } = state;
  
  const allStreams: VideoStream[] = [];
  if (localStream) {
      allStreams.push({ id: 'local-stream', name: `${user.name} (You)`, stream: localStream, isMuted: true });
  }
  if (isScreenSharing && screenStream) {
      allStreams.push({ id: 'screen-share', name: "Your Screen", stream: screenStream, isScreen: true });
  }

  return (
    <header className="w-full bg-gray-900 bg-opacity-90 backdrop-blur-sm p-2 shadow-lg z-20 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3 h-24">
        <h3 className="text-md font-bold text-white pr-4 border-r border-gray-600">In {room.name}</h3>
        <div className="flex items-center gap-3 h-full">
            {allStreams.length > 0 ? (
                allStreams.map(videoStream => <VideoPlayer key={videoStream.id} videoStream={videoStream} />)
            ) : (
                <div className="bg-gray-800 aspect-video rounded-md flex items-center justify-center text-gray-400 text-sm h-full px-4">
                    Getting camera...
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default VideoCallUI;
