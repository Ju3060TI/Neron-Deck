import { useEffect, useRef } from 'react';

interface ScreenShareViewProps {
  stream: MediaStream;
  isMe: boolean;
  sharerName: string;
}

export default function ScreenShareView({ stream, isMe, sharerName }: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800">
      <video ref={videoRef} autoPlay muted={isMe} playsInline className="w-full aspect-video object-contain bg-black" />
      <span className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-black/70 text-xs font-medium text-white">
        {isMe ? 'Du teilst deinen Bildschirm' : `${sharerName} teilt den Bildschirm`}
      </span>
    </div>
  );
}
