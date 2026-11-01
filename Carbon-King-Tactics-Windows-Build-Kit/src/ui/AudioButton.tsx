import { useState } from 'react';
import GIcon from './GameIcon';
import { sound } from '../lib/sound';

export default function AudioButton() {
  const [muted, setMuted] = useState(() => sound.getMuted());

  const handleToggle = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
    if (!isNowMuted) {
      sound.playUiClick();
    }
  };

  return (
    <button
      onClick={handleToggle}
      title={muted ? 'Unmute Audio & Voices' : 'Mute Audio & Voices'}
      aria-label={muted ? 'Unmute audio' : 'Mute audio'}
      className="btn"
    >
      <GIcon name={muted ? 'volumex' : 'volume'} size={14} className={muted ? 'text-red-400' : 'text-teal-300'} />
    </button>
  );
}
