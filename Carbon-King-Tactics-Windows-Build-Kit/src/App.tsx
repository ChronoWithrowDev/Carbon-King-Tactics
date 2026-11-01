import { useEffect } from 'react';
import Stage from './ui/Stage';
import TitleScreen from './screens/TitleScreen';
import MapScreen from './screens/MapScreen';
import PartyScreen from './screens/PartyScreen';
import { ShopScreen, TavernScreen } from './screens/MenuScreens';
import StoryScreen from './screens/StoryScreen';
import BattleView from './battle/BattleView';
import EndingScreen from './screens/EndingScreen';
import SaveScreen from './screens/SaveScreen';
import { useGame } from './game/store';

export default function App() {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) useGame.getState().tickPlayTime(1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Stage
      render={screen => {
        switch (screen) {
          case 'title': return <TitleScreen />;
          case 'map': return <MapScreen />;
          case 'party': return <PartyScreen />;
          case 'shop': return <ShopScreen />;
          case 'tavern': return <TavernScreen />;
          case 'story': return <StoryScreen />;
          case 'battle': return <BattleView />;
          case 'ending': return <EndingScreen />;
          case 'saves': return <SaveScreen />;
        }
      }}
    />
  );
}
