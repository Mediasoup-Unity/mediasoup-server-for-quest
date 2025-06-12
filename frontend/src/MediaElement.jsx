import { useEffect, useRef } from 'react';

const MediaElement = ({ id, kind, track }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && track) {
      const stream = new MediaStream([track]);
      ref.current.srcObject = stream;
    }
  }, [track]);

  if (kind === 'audio') {
    return <audio ref={ref} autoPlay id={id} />;
  }

  return <video ref={ref} autoPlay playsInline className="video" id={id} />;
};

export default MediaElement;
