import {
  Anchor, Beer, Bike, Bomb, Bot, Building, Building2, Camera, Check, ChevronRight, Clock, Coffee, Coins, Compass, Crosshair, Crown,
  Dna, Dog, Download, Eye, Flag, Flame, FolderOpen, Footprints, Ghost, HardHat, Heart, HeartPulse, Landmark, Lock, Map as MapIcon,
  Maximize2, Minimize2, Minus, Moon, Mountain, Music, Orbit, Plane, Play, Plus, Radio, Rocket, RotateCw, Satellite, Save, Shield,
  ShoppingCart, Skull, Sparkles, Star, Sword, Swords, Target, Telescope, Terminal, Timer, Trash2, TreePine, Trophy, Upload, User,
  Users, Volume2, VolumeX, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';

const REGISTRY: Record<string, LucideIcon> = {
  anchor: Anchor, beer: Beer, bike: Bike, bomb: Bomb, bot: Bot, building: Building2, camera: Camera, check: Check,
  chevron: ChevronRight, clock: Clock, coffee: Coffee, coins: Coins, compass: Compass, crosshair: Crosshair, crown: Crown, dna: Dna,
  dog: Dog, download: Download, eye: Eye, flag: Flag, flame: Flame, folder: FolderOpen, footprints: Footprints, ghost: Ghost, hardhat: HardHat,
  heart: Heart, heartpulse: HeartPulse, landmark: Landmark, lock: Lock, map: MapIcon, maximize: Maximize2, minimize: Minimize2, minus: Minus,
  moon: Moon, mountain: Mountain, music: Music, orbit: Orbit, pine: TreePine, plane: Plane, play: Play, plus: Plus, radio: Radio, rocket: Rocket,
  rotate: RotateCw, satellite: Satellite, save: Save, shield: Shield, shop: ShoppingCart, skull: Skull, sparkles: Sparkles, star: Star,
  sword: Sword, swords: Swords, target: Target, telescope: Telescope, terminal: Terminal, timer: Timer, town: Building, trash: Trash2,
  trophy: Trophy, upload: Upload, user: User, users: Users, volume: Volume2, volumex: VolumeX, wrench: Wrench, zap: Zap,
};

export default function GIcon({ name, size = 16, className = '', style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const C = REGISTRY[name] ?? User;
  return <C size={size} className={className} style={style} />;
}
