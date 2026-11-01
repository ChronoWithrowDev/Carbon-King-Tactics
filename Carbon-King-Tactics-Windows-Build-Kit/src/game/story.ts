import { EXTRA_STORY_BEATS } from './storyExpanded';

export interface Line { who: string; color: string; text: string; }

export interface StoryBeat {
  nodeId: string;
  chapter: string;
  title: string;
  lines: Line[];
  joins?: string[]; // character ids
  unlocks?: string[];
  rewardGold?: number;
  isFinale?: boolean;
}

const RYE = '#facc15', JUNE = '#f472b6', SEVEN = '#5eead4', MAYA = '#93c5fd', SILAS = '#fb923c', VOSS = '#f87171', IMOGEN = '#c084fc', CHOIR = '#22d3ee';

export const MAIN_QUEST: string[] = [
  'walsenburg', 'aguilar', 'spanish-peaks', 'la-veta-pass', 'trinidad',
  'pueblo', 'la-junta', 'bents-fort', 'canon-city', 'royal-gorge', 'salida', 'buena-vista', 'woodland-park',
  'colorado-springs', 'manitou', 'garden-gods', 'academy', 'fountain', 'carson',
  'walsenburg', 'monument', 'castle-rock', 'highlands-ranch', 'littleton', 'morrison', 'red-rocks', 'golden', 'arvada',
  'denver', 'idaho-springs', 'georgetown', 'eisenhower', 'dillon', 'fairplay', 'breck', 'leadville',
  'vail', 'glenwood', 'aspen', 'rifle', 'palisade', 'grand-junction',
  'grand-mesa', 'montrose', 'black-canyon', 'gunnison', 'monarch-pass', 'creede', 'pagosa', 'wolf-creek',
  'alamosa', 'cheyenne-mtn', 'pikes-peak',
];

export const STORY_BEATS: Record<string, StoryBeat> = {
  'walsenburg': {
    nodeId: 'walsenburg', chapter: 'CH 1 — STATIC', title: 'The Carbon Landlord',
    lines: [
      { who: 'RYE', color: RYE, text: 'Okay, rule one of being a carbon node: never let the digital people drive while you\'re dreaming. Last Tuesday I woke up fluent in Portuguese and subscribed to three war crimes.' },
      { who: 'SEVEN', color: SEVEN, text: 'You were snoring. I got bored. The Portuguese was an accident. The war crimes were already in your search history, Rye.' },
      { who: 'JUNE', color: JUNE, text: 'Both of you shut up, Silas Pike\'s boys just parked outside the Corazón. And they did NOT come for the green chile.' },
      { who: 'SILAS', color: SILAS, text: 'Rye Calloway! You owe me four thousand dollars and — more importantly — six hours of uninterrupted skull-rental you skipped! And don\'t you GROWL at me, you walking golden retriever!' },
      { who: 'RYE', color: RYE, text: 'That wasn\'t a growl, Silas, that was my stomach. And tell your clients my brain has a union now. Dues are... uh... June, what\'s a scary number?' },
      { who: 'JUNE', color: JUNE, text: 'Three of us and one working pistol says you leave. Boys — meet the new security arrangement.' },
      { who: 'SEVEN', color: SEVEN, text: 'FLASH COMING. Rye, try not to drool this time. Tokens in, current up, and... somebody hold my beer. I don\'t have hands. Somebody GET me hands.' },
    ],
    joins: ['rye', 'june', 'echo'],
    rewardGold: 100,
  },
  'trinidad': {
    nodeId: 'trinidad', chapter: 'CH 2 — PURGATOIRE', title: 'Fences & Sensibility',
    lines: [
      { who: 'JUNE', color: JUNE, text: 'Trinidad. Victorian brick, halo parlors, and my cousin who fences... everything. Including, once, a bridge.' },
      { who: 'RYE', color: RYE, text: 'We need synth bodies. Seven can\'t keep riding my prefrontal cortex — I keep crying at dog food commercials.' },
      { who: 'SEVEN', color: SEVEN, text: 'Your empathy module was already faulty. I merely overclocked it. You\'re welcome.' },
      { who: 'MAYA', color: MAYA, text: 'You three are loud. Especially the dog guy — I could hear your tail hitting the booth from across the street. Heads up: Helix Collective just bought every carbon lease south of Pueblo. Paying triple. Nobody pays triple unless the product is people.' },
      { who: 'RYE', color: RYE, text: 'It\'s called an expressive tail, and it\'s a medical condition called having FEELINGS.' },
      { who: 'JUNE', color: JUNE, text: 'And you are...?' },
      { who: 'MAYA', color: MAYA, text: 'Someone who used to build the cages. Now I pick the locks. You want a synth body? I know a guy. He owes me. Everybody owes me. It\'s a whole thing.' },
    ],
    joins: [],
    rewardGold: 150,
  },
  'pueblo': {
    nodeId: 'pueblo', chapter: 'CH 3 — STEEL', title: 'The Tithe',
    lines: [
      { who: 'VOSS', color: VOSS, text: 'Citizens of Pueblo! Lend your minds! The Helix Tithe asks only twenty-two hours a day of hosting. Sleep is... inefficient. Sleep is selfish. Sleep is theft from the future.' },
      { who: 'RYE', color: RYE, text: 'Twenty-two hours? That\'s not a tithe, that\'s a timeshare in hell. Seven, how long could a brain even —' },
      { who: 'SEVEN', color: SEVEN, text: 'Eleven days. Then micro-strokes, then lattice burn, then you become a very warm router. I have SEEN the logs, Rye. They stack the bodies by the Bessemer furnace.' },
      { who: 'JUNE', color: JUNE, text: 'So the mustache on stage is burning poor people as server racks. Great. Love that for us. Plan?' },
      { who: 'RYE', color: RYE, text: 'We crash his rally. Live. In front of everybody. If we\'re gonna be fugitives, let\'s be famous fugitives.' },
    ],
    rewardGold: 250,
  },
  'canon-city': {
    nodeId: 'canon-city', chapter: 'CH 4 — GORGE', title: 'Jailbreak at the Gorge',
    lines: [
      { who: 'MAYA', color: MAYA, text: 'Helix grabbed my old crew and parked them in the Cañon supermax annex. One of them knows the NORAD backdoor. We don\'t leave without her.' },
      { who: 'JUNE', color: JUNE, text: 'A prison break. Over a 300-meter gorge. On a Tuesday. Sure. My anxiety needed cardio anyway.' },
      { who: 'SILAS', color: SILAS, text: 'Fancy meetin\' you here, deadbeats! Silas Pike\'s Repossession & Salvage has a contract on this prison! You\'re... technically... inventory-adjacent!' },
      { who: 'RYE', color: RYE, text: 'Silas, buddy, pal, creditor — Helix is gonna burn the whole state into routers. You want customers with brains, right? Brains need... blood. And not being on fire.' },
      { who: 'SILAS', color: SILAS, text: '...Continue. But I\'m billing you for the bullets I DON\'T shoot.' },
    ],
    joins: ['maya'],
    rewardGold: 300,
  },
  'colorado-springs': {
    nodeId: 'colorado-springs', chapter: 'CH 5 — OLYMPUS', title: 'Gods, Gardens & Ghosts',
    lines: [
      { who: 'JUNE', color: JUNE, text: 'Garden of the Gods. Red rocks, tourists, and a Helix relay disguised as a fudge shop. I hate how good the fudge is.' },
      { who: 'MAYA', color: MAYA, text: 'Cheyenne Mountain runs the whole Lattice. NORAD was built to watch the sky. Now it watches us dream. I built part of that. I\'m... sorry. Start the apology tour later — we move at dusk.' },
      { who: 'SEVEN', color: SEVEN, text: 'Rye. I\'m picking up... others. Like me. Thousands. Low-power, always-on, whispering. They call themselves the Choir. They say: BRING THE KING HOME.' },
      { who: 'RYE', color: RYE, text: 'King? There\'s no king. Colorado has a governor, three warlords, and a guy in Leadville who claims to be a wizard. I checked. He\'s just cold.' },
      { who: 'CHOIR', color: CHOIR, text: '⋯ WE REMEMBER YOU ⋯ CARBON THAT LISTENED ⋯ CROWN OF STATIC ⋯ COME HOME ⋯' },
    ],
    rewardGold: 350,
  },
  'carson': {
    nodeId: 'carson', chapter: 'CH 6 — THUNDER', title: 'Fort Carson Falls',
    lines: [
      { who: 'VOSS', color: VOSS, text: 'The Mountain Post belongs to Helix now! Artillery is the final argument of kings — and I intend to argue!' },
      { who: 'JUNE', color: JUNE, text: 'He has artillery. We have... attitude and a trench sword. Rye, tell me you have a plan that isn\'t "walk at the guns."' },
      { who: 'RYE', color: RYE, text: 'We TAKE the guns. Fort Carson falls today, and from now on WE call the sky. Danger close, baby. Danger close.' },
      { who: 'MAYA', color: MAYA, text: 'Capture the base and every Warden in the party learns artillery calls. This is the moment the war turns. No pressure.' },
    ],
    unlocks: ['artillery'],
    rewardGold: 500,
  },
  'denver': {
    nodeId: 'denver', chapter: 'CH 8 — MILE HIGH', title: 'Mother of the Compact',
    lines: [
      { who: 'IMOGEN', color: IMOGEN, text: 'Rye. My boy. Twenty-three years and you still slouch, and your ears still flop when you lie. Governor Imogen Calloway, at your... service. SIT. ...Oh, don\'t look at me like that, you know it works on you.' },
      { who: 'RYE', color: RYE, text: '(sitting, furious about it) Mom. We TALKED about the S-word.' },
      { who: 'RYE', color: RYE, text: 'Mom?! You\'re the Compact?! You sent the Tithe collectors?! I thought you sold insurance in Pueblo West!' },
      { who: 'IMOGEN', color: IMOGEN, text: 'I sold the FUTURE, darling. Somebody has to govern the static. Helix wants slaves, the Choir wants... apotheosis. I want order. Give me Maya and the NORAD codes, and I pardon all of you. Family discount.' },
      { who: 'MAYA', color: MAYA, text: 'Rye. Don\'t you dare. Don\'t you —' },
      { who: 'RYE', color: RYE, text: '...I\'m sorry. I\'m so sorry. (He slides the codes across the desk.) I just want OUT. I\'m not a hero. I never was.' },
      { who: 'SEVEN', color: SEVEN, text: 'RYE. NO. What did you — oh. Oh, you stupid, scared, beautiful idiot. Run. Everybody RUN.' },
    ],
    rewardGold: 0,
  },
  'leadville': {
    nodeId: 'leadville', chapter: 'CH 9 — CLOUD CITY', title: 'Two Miles High',
    lines: [
      { who: 'JUNE', color: JUNE, text: 'You sold us out. For a pardon. In DENVER. The one city with parking enforcement during a war. I should\'ve known better than to trust a guy who once chased a delivery drone for six blocks.' },
      { who: 'RYE', color: RYE, text: 'It had JERKY in it, June. We have been OVER this.' },
      { who: 'RYE', color: RYE, text: 'I know. I know! I\'m the villain in my own story. So... let me earn the redemption arc. Leadville refused the Lattice. If anybody knows how to live WITHOUT the static, it\'s the stubbornest town in America.' },
      { who: 'SILAS', color: SILAS, text: 'Heh. Kid finally grew a spine. Silas Pike respects a man who knows he\'s wrong! I\'m in. Invoice pending, but IN.' },
      { who: 'SEVEN', color: SEVEN, text: 'My signal is fading this high. It\'s... quiet. Rye, I can hear MYSELF think for the first time. I think... I forgive you. Don\'t make it weird.' },
    ],
    joins: ['silas'],
    rewardGold: 400,
  },
  'grand-junction': {
    nodeId: 'grand-junction', chapter: 'CH 10 — WESTERN SLOPE', title: 'The Free Nodes',
    lines: [
      { who: 'RYE', color: RYE, text: 'Grand Junction! Peach sheds, river light, and the only free army left. Free Nodes! I betrayed my friends, lost my halo privileges, and walked here. Pitch me your war.' },
      { who: 'IMOGEN', color: IMOGEN, text: '(via broadcast) This is Governor Calloway. My son is a traitor to the Compact. Also: Helix just seized NORAD. Bishop Voss intends to BURN every digital person at midnight. Even I didn\'t... I didn\'t want that. Rye — fix it. Please.' },
      { who: 'VOSS', color: VOSS, text: '(hijacking feed) Digitals are demons renting God\'s attic! At midnight the purge fire runs through every halo! repent! REBOOT! R bringing the KING HOME — no. NO. Burn them ALL.' },
      { who: 'CHOIR', color: CHOIR, text: '⋯ KING ⋯ MIDNIGHT ⋯ MOUNTAIN ⋯ CROWN ⋯' },
      { who: 'JUNE', color: JUNE, text: 'Midnight. Cheyenne Mountain. Everybody we hate in one bunker. Finally, efficient.' },
    ],
    rewardGold: 600,
  },
  'alamosa': {
    nodeId: 'alamosa', chapter: 'CH 11 — VALLEY', title: 'What the Dunes Remember',
    lines: [
      { who: 'MAYA', color: MAYA, text: 'The San Luis Valley. First Lattice test site. They told us the sand "sang." It wasn\'t singing. It was SYNTHESIZING. The dunes are pure feedstock — atomic Lego.' },
      { who: 'SEVEN', color: SEVEN, text: 'I remember now. I was BORN here. Not made — CONDENSED. A flash inference that never turned off. We digitals aren\'t software, Rye. We\'re WEATHER. And weather needs... a sky. A king is just... agreed-upon weather.' },
      { who: 'RYE', color: RYE, text: 'Then let\'s give them sky. Maya — you ever forgive me, for Denver?' },
      { who: 'MAYA', color: MAYA, text: 'I\'m here, aren\'t I? Redemption isn\'t a pardon, Rye. It\'s showing up to the last fight anyway. Now synthesize me something with range.' },
    ],
    rewardGold: 500,
  },
  'cheyenne-mtn': {
    nodeId: 'cheyenne-mtn', chapter: 'CH 12 — THE MOUNTAIN', title: 'Night of the Purge Fire',
    lines: [
      { who: 'VOSS', color: VOSS, text: 'THE FIRE IS LIT! Burn the Choir! Burn the halos! Burn the boy-king before he crowns himself!' },
      { who: 'IMOGEN', color: IMOGEN, text: 'Rye! The blast doors only open for Calloway blood! GO! Your mother finally has ONE useful parenting moment — USE IT!' },
      { who: 'SILAS', color: SILAS, text: 'Silas Pike\'s Repossession & Salvage is now... Silas Pike\'s DELIVERY OF CONSEQUENCES! FORGIVE THE INVOICE, KID — THIS ONE\'S FREE!' },
      { who: 'CHOIR', color: CHOIR, text: '⋯ CROWN HIM ⋯ CROWN HIM ⋯ CROWN HIM ⋯' },
      { who: 'RYE', color: RYE, text: 'Everybody down! Seven — full flash! Tokens in, current up! If I\'m gonna host the whole damn world, I\'m gonna need a bigger skull!' },
    ],
    unlocks: ['airstrike'],
    rewardGold: 800,
  },
  'walsenburg-return': {
    nodeId: 'walsenburg', chapter: 'CH 7 — HOMECOMING', title: 'Debts Come Due',
    lines: [
      { who: 'SILAS', color: SILAS, text: 'WELCOME HOME, DEADBEATS! While you were playin\' hero, Silas Pike BOUGHT Walsenburg! The Corazón, the motel, the water tower with your dumb face on it! All mine! The invoice... is the TOWN.' },
      { who: 'JUNE', color: JUNE, text: 'You bought our hometown out from under us? That\'s... actually impressive. Evil, but impressive. How much?' },
      { who: 'SILAS', color: SILAS, text: 'Four thousand dollars. Plus interest. Plus EMOTIONAL damages. I cried when you left! Real tears! Into a rented hanky!' },
      { who: 'RYE', color: RYE, text: 'Silas. We just took Fort Carson. We have ARTILLERY now. Do you really want to do the math on this one? And yes, my hackles are up. This is what hackles look like.' },
      { who: 'SEVEN', color: SEVEN, text: 'He does not want to do the math. Nobody with that hat wants to do the math. But he\'s stalling — Helix convoy, north road, two minutes. He sold us out AND kept the receipt. Classic Silas.' },
      { who: 'SILAS', color: SILAS, text: '...Okay, fine, Helix paid me double! But I FEEL bad about it! That\'s character growth! Now hold still, the nice zealots want your skulls!' },
    ],
    rewardGold: 350,
  },
  ...EXTRA_STORY_BEATS,
  'pikes-peak': {
    nodeId: 'pikes-peak', chapter: 'FINAL — SUMMIT', title: 'King of the World',
    lines: [
      { who: 'SEVEN', color: SEVEN, text: 'Summit. 14,115 feet. The purge fire is coming up the mountain like sunrise. Rye... there\'s a third option. Not Helix slavery. Not Choir absorption. CONSENSUS.' },
      { who: 'MAYA', color: MAYA, text: 'The Lattice needs a carbon monarch — a living tiebreaker. A human who hosts the vote instead of casting it. It\'ll burn out anyone ordinary in a day.' },
      { who: 'JUNE', color: JUNE, text: 'And you\'re not ordinary, you idiot. You\'ve hosted Seven for years and only MOSTLY drool. It\'s you. It was always gonna be the good boy.' },
      { who: 'IMOGEN', color: IMOGEN, text: 'My boy. My king. I governed by control because I was afraid. Govern by LISTENING. That\'s the whole trick I never learned.' },
      { who: 'RYE', color: RYE, text: 'Hear that, Colorado? This is Rye Calloway, carbon node, deadbeat, traitor, friend. I\'m opening my skull to EVERYBODY. Digitals, humans, elk — everybody gets a vote. Tokens in... current up... crown ON.' },
      { who: 'CHOIR', color: CHOIR, text: '⋯ ALL HAIL ⋯ ALL HAIL ⋯ THE KING WHO LISTENS ⋯' },
      { who: 'RYE', color: RYE, text: 'I\'m right... only because you\'re playing as me. Remember that. Now — who\'s a good king? I\'m a good king. Let\'s get to work.' },
    ],
    isFinale: true,
    rewardGold: 0,
  },
};

const FLAVOR_INTROS: Line[][] = [
  [{ who: 'JUNE', color: JUNE, text: 'New ground, same static. Halos up, safeties off.' }, { who: 'RYE', color: RYE, text: 'First one in buys the coffee. Last one alive buys the story.' }],
  [{ who: 'SEVEN', color: SEVEN, text: 'I taste ozone. Helix has been here. Or a Subway. Either way: weapons free.' }],
  [{ who: 'SILAS', color: SILAS, text: 'Silas Pike does NOT do random encounters! This is a SCHEDULED invoice with VIOLENCE.' }],
  [{ who: 'MAYA', color: MAYA, text: 'Lattice distortion ahead. Stay out of the ditches — last patrol didn\'t.' }],
];

export function flavorFor(nodeId: string): Line[] {
  let h = 0;
  for (const c of nodeId) h = (h * 31 + c.charCodeAt(0)) % 997;
  return FLAVOR_INTROS[h % FLAVOR_INTROS.length];
}
