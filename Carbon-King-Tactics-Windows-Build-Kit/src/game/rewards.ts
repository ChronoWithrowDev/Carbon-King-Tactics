const BATTLE_REWARD_MULTIPLIER = 1.2;

export function calculateBattleRewards(level: number, survivors: number, hasScavenge: boolean) {
  const xp = Math.round((55 + level * 12 + survivors * 6) * BATTLE_REWARD_MULTIPLIER);
  const jp = Math.round((70 + level * 9) * BATTLE_REWARD_MULTIPLIER);
  const baseGold = Math.round((70 + level * 26) * BATTLE_REWARD_MULTIPLIER);

  return {
    xp,
    jp,
    gold: hasScavenge ? Math.round(baseGold * 1.25) : baseGold,
  };
}