import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";

// Egyszerű WebRTC peer connection management PHP signalinggel
export default function VideoCallUI({ room }: { room: any }) {
  const { user, signalingMessages, sendSignaling } = useAppContext();
  const [remoteStreams, setRemoteStreams] = useState<any[]>([]);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // 1. Helyi stream bekapcsolása
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    });
  }, []);

  // 2. PeerConnection setup
  useEffect(() => {
    if (!localStream) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // Local stream hozzáadása
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // ICE candidate küldése
    pc.onicecandidate = (event) => {
      if (event.candidate)
        sendSignaling("ice-candidate", JSON.stringify(event.candidate));
    };

    // Remote stream kezelése
    pc.ontrack = (event) => {
      setRemoteStreams((streams) => {
        if (streams.find(s => s.id === event.streams[0].id)) return streams;
        return [...streams, event.streams[0]];
      });
    };

    setPeerConnection(pc);

    // OFFER generálása (ha én vagyok a hívó)
    sendSignaling("ready", "");

    return () => {
      pc.close();
    };
  }, [localStream]);

  // 3. Signaling üzenetek feldolgozása (OFFER/ANSWER/ICE)
  useEffect(() => {
    if (!peerConnection) return;
    for (const msg of signalingMessages) {
      if (msg.user_id === user.id) continue; // saját üzenet kihagyása
      if (msg.message_type === "offer") {
        peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(msg.message)));
        peerConnection.createAnswer().then(answer => {
          peerConnection.setLocalDescription(answer);
          sendSignaling("answer", JSON.stringify(answer));
        });
      } else if (msg.message_type === "answer") {
        peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(msg.message)));
      } else if (msg.message_type === "ice-candidate") {
        const candidate = new RTCIceCandidate(JSON.parse(msg.message));
        peerConnection.addIceCandidate(candidate);
      } else if (msg.message_type === "ready") {
        // Ha mindketten készen állnak, akkor csak az egyikük generál offer-t
        if (peerConnection.signalingState === "stable") {
          peerConnection.createOffer().then(offer => {
            peerConnection.setLocalDescription(offer);
            sendSignaling("offer", JSON.stringify(offer));
          });
        }
      }
    }
  }, [signalingMessages, peerConnection]);

  // Képernyőmegosztás
  async function startScreenShare() {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const videoTrack = displayStream.getVideoTracks()[0];
    if (peerConnection && localStream) {
      const sender = peerConnection.getSenders().find(s => s.track?.kind === "video");
      sender?.replaceTrack(videoTrack);
      videoTrack.onended = () => {
        sender?.replaceTrack(localStream.getVideoTracks()[0]);
      };
    }
  }

  return (
    <div className="flex flex-col items-center bg-black py-4">
      <div className="flex gap-2">
        <video ref={localVideoRef} autoPlay muted className="w-48 h-36 bg-gray-800 rounded mb-2" />
        {remoteStreams.map((stream, i) => (
          <video key={stream.id} autoPlay
            ref={video => video && (video.srcObject = stream)}
            className="w-48 h-36 bg-gray-700 rounded mb-2"
          />
        ))}
      </div>
      <button onClick={startScreenShare} className="bg-blue-700 px-4 py-2 rounded text-white mt-2">
        Képernyő megosztása
      </button>
    </div>
  );
}
