type NodeKind = 'city' | 'town' | 'landmark' | 'base';

export interface WorldNode {
  id: string;
  name: string;
  kind: NodeKind;
  // 0..100 map coords (x: west->east, y: north->south)
  x: number;
  y: number;
  region: string;
  blurb: string;
  isBase?: boolean;
  landmarkBonus?: string;
  level: number; // suggested enemy level
}

interface RoadEdge { a: string; b: string; highway: string }

// Colorado's 95 cities, towns, bases, passes, parks, and landmarks.
// x maps lon -109.05..-102.04 -> 0..100, y maps lat 41..37 -> 0..100
export const WORLD_NODES: WorldNode[] = [
  { id: 'walsenburg', name: 'Walsenburg', kind: 'town', x: 68, y: 77, region: 'Spanish Peaks Country', blurb: 'Old coal town under the twin Spanish Peaks. Halo static is thick here — the Lattice hums through the brick.', level: 1 },
  { id: 'aguilar', name: 'Aguilar', kind: 'town', x: 66.5, y: 82, region: 'Spanish Peaks Country', blurb: 'Half-empty main street, full-signal sky. Drifters trade carbon time for gas.', level: 2 },
  { id: 'spanish-peaks', name: 'Spanish Peaks', kind: 'landmark', x: 63, y: 80.5, region: 'Sangres', blurb: 'Twin dikes radiating like circuitry. Miners swear the rock dreams in tokens.', landmarkBonus: 'High ground + Flash range', level: 3 },
  { id: 'la-veta-pass', name: 'La Veta Pass', kind: 'landmark', x: 61, y: 76.5, region: 'Sangres', blurb: 'Wind farm blades turning slow over the pass. Perfect ambush country.', level: 3 },
  { id: 'trinidad', name: 'Trinidad', kind: 'city', x: 69, y: 88, region: 'Purgatoire', blurb: 'Brick Victorian blocks and halo parlors. The southern gate of Colorado.', level: 4 },
  { id: 'trinidad-lake', name: 'Trinidad Lake', kind: 'landmark', x: 66, y: 86.5, region: 'Purgatoire', blurb: 'Reservoir glass at dawn. Fisher Peak watches like a sleeping sovereign.', level: 4 },
  { id: 'fishers-peak', name: "Fisher's Peak", kind: 'landmark', x: 70.5, y: 92, region: 'Purgatoire', blurb: 'Newest state park. High basalt mesa — a natural throne.', landmarkBonus: 'Elevation +2', level: 5 },
  { id: 'pueblo', name: 'Pueblo', kind: 'city', x: 70, y: 67.5, region: 'Arkansas Valley', blurb: 'Steel City. The Bessemer furnaces now print synth-alloy for the Compact.', level: 5 },
  { id: 'pueblo-reservoir', name: 'Pueblo Reservoir', kind: 'landmark', x: 64.5, y: 67.5, region: 'Arkansas Valley', blurb: 'Sailboats and smugglers. Water is compute coolant out here.', level: 5 },
  { id: 'canon-city', name: 'Cañon City', kind: 'town', x: 61.5, y: 64, region: 'Royal Gorge', blurb: 'Prison town turned caravan hub. Everybody has a second name here.', level: 6 },
  { id: 'royal-gorge', name: 'Royal Gorge', kind: 'landmark', x: 59.5, y: 64.5, region: 'Royal Gorge', blurb: 'A 300-meter gash in the earth with a bridge like a suture.', landmarkBonus: 'Choke bridge map', level: 7 },
  { id: 'fountain', name: 'Fountain', kind: 'town', x: 70.5, y: 60.5, region: 'Pikes Peak', blurb: 'Military families, taco trucks, and halo repair kiosks.', level: 7 },
  { id: 'colorado-springs', name: 'Colorado Springs', kind: 'city', x: 71, y: 56, region: 'Pikes Peak', blurb: 'Olympic City. Megachurches and megaservers share the same grid.', level: 8 },
  { id: 'manitou', name: 'Manitou Springs', kind: 'town', x: 68.5, y: 56.5, region: 'Pikes Peak', blurb: 'Arcade air, mineral springs, and fortune-telling digitals.', level: 8 },
  { id: 'garden-gods', name: 'Garden of the Gods', kind: 'landmark', x: 69.5, y: 54.5, region: 'Pikes Peak', blurb: 'Red fins balanced like stacked error-correction codes.', landmarkBonus: 'Cover +15%', level: 8 },
  { id: 'pikes-peak', name: 'Pikes Peak', kind: 'landmark', x: 65, y: 56, region: 'Pikes Peak', blurb: '14,115 ft. "America the Beautiful" was drafted above a sea of static.', landmarkBonus: 'Summit map: max height', level: 10 },
  { id: 'cheyenne-mtn', name: 'Cheyenne Mtn NORAD', kind: 'base', x: 68, y: 58.5, region: 'Pikes Peak', blurb: 'CLASSIFIED LATTICE CORE. The mountain that dreams the state awake.', isBase: true, level: 14 },
  { id: 'cripple-creek', name: 'Cripple Creek', kind: 'town', x: 65, y: 60, region: 'Gold Belt', blurb: 'Casino town on a gold mine. The slots pay out in job points.', level: 9 },
  { id: 'woodland-park', name: 'Woodland Park', kind: 'town', x: 67, y: 52.5, region: 'Ute Pass', blurb: 'City above the clouds. Diners serve pie and black-market halos.', level: 9 },
  { id: 'monument', name: 'Monument', kind: 'town', x: 71, y: 48.5, region: 'Palmer Divide', blurb: 'Ponderosa commuter belt. Every garage hides a generator.', level: 9 },
  { id: 'academy', name: 'Air Force Academy', kind: 'base', x: 71.5, y: 51.5, region: 'Pikes Peak', blurb: 'Cadet chapel spires like antennae. Drone honor guard never sleeps.', isBase: true, level: 10 },
  { id: 'castle-rock', name: 'Castle Rock', kind: 'town', x: 70, y: 42, region: 'Palmer Divide', blurb: 'Outlet malls and a volcanic butte. Snipers love the Rock.', level: 10 },
  { id: 'parker', name: 'Parker', kind: 'town', x: 73.5, y: 40, region: 'Front Range', blurb: 'Suburban grid, aggressively landscaped. HOAs with air defense.', level: 10 },
  { id: 'highlands-ranch', name: 'Highlands Ranch', kind: 'town', x: 69, y: 39.5, region: 'Front Range', blurb: 'Twenty miles of cul-de-sacs. The war never found the address.', level: 10 },
  { id: 'littleton', name: 'Littleton', kind: 'town', x: 69, y: 37.5, region: 'Front Range', blurb: 'Old downtown, new walls. Lockheed spires on the horizon.', level: 11 },
  { id: 'centennial', name: 'Centennial', kind: 'town', x: 72, y: 37.5, region: 'Front Range', blurb: 'Tech-center glass. Every window reflects a different future.', level: 11 },
  { id: 'denver', name: 'Denver — Capitol Hill', kind: 'city', x: 72, y: 33.5, region: 'Mile High', blurb: 'The Mile High Compact capital. Gold dome, neon halo-den.', level: 12 },
  { id: 'aurora', name: 'Aurora', kind: 'city', x: 76.5, y: 34.5, region: 'Mile High', blurb: 'Buckley Space Force Base hums. Strip malls in seventeen languages.', level: 12 },
  { id: 'lakewood', name: 'Lakewood', kind: 'town', x: 69, y: 33.5, region: 'Mile High', blurb: 'Federal Center sprawl. Casa Bonita still stands. Priorities intact.', level: 11 },
  { id: 'golden', name: 'Golden', kind: 'town', x: 68, y: 32.5, region: 'Foothills', blurb: 'Coors, mines, and the School of Mines synth-foundry.', level: 11 },
  { id: 'morrison', name: 'Morrison', kind: 'town', x: 68, y: 35.5, region: 'Foothills', blurb: 'Tiny main street under red stone. Foot traffic only — bring a mace.', level: 11 },
  { id: 'red-rocks', name: 'Red Rocks Amphitheatre', kind: 'landmark', x: 67, y: 34.5, region: 'Foothills', blurb: 'Natural amphitheater. The best acoustics for artillery in America.', landmarkBonus: 'Amphitheater map', level: 12 },
  { id: 'arvada', name: 'Arvada', kind: 'town', x: 69.5, y: 30.5, region: 'Mile High', blurb: 'Olde Town streetcars retrofitted as gun trucks. Charming. Lethal.', level: 11 },
  { id: 'westminster', name: 'Westminster', kind: 'town', x: 70.5, y: 28.5, region: 'Mile High', blurb: 'Butterfly pavilion and big-box fortresses.', level: 11 },
  { id: 'thornton', name: 'Thornton', kind: 'town', x: 72.5, y: 27.5, region: 'Mile High', blurb: 'Subdivisions to the horizon. Every cul-de-sac a killbox.', level: 11 },
  { id: 'commerce-city', name: 'Commerce City', kind: 'town', x: 74.5, y: 30, region: 'Mile High', blurb: 'Refineries and rail yards. Smells like victory and diesel.', level: 12 },
  { id: 'dia', name: 'DIA — Denver Intl Airport', kind: 'base', x: 79.5, y: 29.5, region: 'Plains', blurb: 'Blue horse, red eyes, miles of tunnels. The Compact launches air strikes from here.', isBase: true, level: 13 },
  { id: 'brighton', name: 'Brighton', kind: 'town', x: 74, y: 24.5, region: 'Plains', blurb: 'Beet fields and distribution hubs. Flat, fast, dangerous.', level: 11 },
  { id: 'boulder', name: 'Boulder', kind: 'city', x: 68, y: 27.5, region: 'Foothills', blurb: 'Flatirons above, startups below. Everybody microdoses inference.', level: 12 },
  { id: 'longmont', name: 'Longmont', kind: 'town', x: 69.5, y: 22.5, region: 'Front Range', blurb: 'Old turkey plant, new chip fab. The air smells like ozone.', level: 12 },
  { id: 'lyons', name: 'Lyons', kind: 'town', x: 67, y: 24.5, region: 'Foothills', blurb: 'Double gateway to the park. Sandstone and banjos.', level: 12 },
  { id: 'loveland', name: 'Loveland', kind: 'town', x: 68, y: 17.5, region: 'Front Range', blurb: 'Sweetheart City. Valentine remailers now route coded orders.', level: 12 },
  { id: 'fort-collins', name: 'Fort Collins', kind: 'city', x: 67, y: 12.5, region: 'Front Range', blurb: 'Choice City. Brewery tanks double as coolant for server barns.', level: 13 },
  { id: 'greeley', name: 'Greeley', kind: 'city', x: 73.5, y: 15.5, region: 'Plains', blurb: 'Meatpacking and monsoons. Toughest militia on the northern plains.', level: 13 },
  { id: 'estes-park', name: 'Estes Park / RMNP', kind: 'landmark', x: 62, y: 17.5, region: 'High Country', blurb: 'Stanley Hotel looms. Elk outnumber people; digitals outnumber elk.', landmarkBonus: 'Alpine maze', level: 13 },
  { id: 'nederland', name: 'Nederland', kind: 'town', x: 65, y: 28.5, region: 'High Country', blurb: 'Frozen Dead Guy days are over. The guy walked. Ask around.', level: 12 },
  { id: 'horsetooth', name: 'Horsetooth Reservoir', kind: 'landmark', x: 64, y: 12.5, region: 'Front Range', blurb: 'Dam-top road, sunset choke. Bring long rifles.', level: 13 },
  { id: 'pawnee', name: 'Pawnee Grasslands', kind: 'landmark', x: 82, y: 14.5, region: 'Plains', blurb: 'Nothing to the horizon — perfect for seeing company coming.', landmarkBonus: 'No cover, long sightlines', level: 13 },
  { id: 'sterling', name: 'Sterling', kind: 'town', x: 84.5, y: 17.5, region: 'Plains', blurb: 'Sugar factory, truck stops, and a very polite roadblock.', level: 13 },
  { id: 'fort-morgan', name: 'Fort Morgan', kind: 'town', x: 80, y: 21.5, region: 'Plains', blurb: 'Glenn Miller was born here. The big bands play static now.', level: 13 },
  { id: 'limon', name: 'Limon', kind: 'town', x: 82, y: 39.5, region: 'Plains', blurb: 'The Hub City. Five highways, one water tower, zero illusions.', level: 12 },
  { id: 'burlington', name: 'Burlington', kind: 'town', x: 92.5, y: 37.5, region: 'Plains', blurb: 'Last carousel in Colorado. Brass rings and brass casings.', level: 13 },
  { id: 'lamar', name: 'Lamar', kind: 'town', x: 90, y: 67.5, region: 'Arkansas Valley', blurb: 'Windmills and grain elevators. The Compact drafts hard here.', level: 9 },
  { id: 'la-junta', name: 'La Junta', kind: 'town', x: 81, y: 66.5, region: 'Arkansas Valley', blurb: 'Rail junction, Koshare kiva, and the best green chile on US-50.', level: 8 },
  { id: 'bents-fort', name: "Bent's Fort", kind: 'landmark', x: 83.5, y: 66.5, region: 'Arkansas Valley', blurb: 'Adobe trading post rebuilt. Still trading — just different goods.', level: 8 },
  { id: 'idaho-springs', name: 'Idaho Springs', kind: 'town', x: 65, y: 31, region: 'I-70 Corridor', blurb: 'Hot springs and cold deals. Beau Jo\'s pizza as field ration.', level: 12 },
  { id: 'georgetown', name: 'Georgetown / Loveland Pass', kind: 'landmark', x: 62, y: 30.5, region: 'I-70 Corridor', blurb: 'Victorian loop railroad. Hairpins made for ambushes.', landmarkBonus: 'Hairpin heights', level: 12 },
  { id: 'eisenhower', name: 'Eisenhower Tunnel', kind: 'landmark', x: 60, y: 31.5, region: 'Divide', blurb: 'Two bores through the Divide. Whoever holds the tunnel holds the state.', landmarkBonus: 'Tunnel choke', level: 13 },
  { id: 'dillon', name: 'Dillon / Silverthorne', kind: 'town', x: 58, y: 29.5, region: 'Summit', blurb: 'Outlet malls around a drowned town. The reservoir hides an old church spire.', level: 13 },
  { id: 'breck', name: 'Breckenridge', kind: 'town', x: 58, y: 33.5, region: 'Summit', blurb: 'Ski lifts carry cargo now. Ullr festival never ended — it escalated.', level: 13 },
  { id: 'leadville', name: 'Leadville', kind: 'town', x: 55, y: 37.5, region: 'High Country', blurb: 'Two miles high and twice as stubborn. Cloud City refuses the Lattice.', level: 13 },
  { id: 'vail', name: 'Vail', kind: 'town', x: 52, y: 31.5, region: 'High Country', blurb: 'Bavarian facades, billionaire bunkers. Avalanche guns point downhill now.', level: 13 },
  { id: 'fairplay', name: 'Fairplay / South Park', kind: 'town', x: 60.5, y: 38.5, region: 'South Park', blurb: 'Yes, that South Park. No, they are not amused anymore.', level: 12 },
  { id: 'buena-vista', name: 'Buena Vista', kind: 'town', x: 56, y: 44.5, region: 'Collegiate Peaks', blurb: 'Fourteeners in a row like a jury. Hot springs for sore carbon nodes.', level: 11 },
  { id: 'salida', name: 'Salida', kind: 'town', x: 55, y: 51.5, region: 'Arkansas Valley', blurb: 'River town, raft put-in, rumor mill. The Arkansas runs fast with news.', level: 10 },
  { id: 'monarch-pass', name: 'Monarch Pass', kind: 'landmark', x: 51, y: 51.5, region: 'Divide', blurb: '11,312 ft of switchbacks. Tram to the top, trouble all the way down.', landmarkBonus: 'Pass control', level: 11 },
  { id: 'gunnison', name: 'Gunnison', kind: 'town', x: 45, y: 52.5, region: 'Gunnison Basin', blurb: 'Coldest readings, warmest bars. Western State kids run signals intel.', level: 11 },
  { id: 'black-canyon', name: 'Black Canyon', kind: 'landmark', x: 42, y: 53.5, region: 'Gunnison Basin', blurb: 'A sheer black crack. Painted Wall drops 700m — mind the edge tiles.', landmarkBonus: 'Cliff map', level: 12 },
  { id: 'montrose', name: 'Montrose', kind: 'town', x: 38, y: 49.5, region: 'Western Slope', blurb: 'Gateway to the Black. Outfitters sell rifles and reassurance.', level: 11 },
  { id: 'ouray', name: 'Ouray', kind: 'town', x: 38, y: 56.5, region: 'San Juans', blurb: 'Switzerland of America. Ice climbing and hot springs, sometimes same day.', level: 11 },
  { id: 'telluride', name: 'Telluride', kind: 'town', x: 34, y: 59.5, region: 'San Juans', blurb: 'Box canyon festival town. The gondola runs all night for couriers.', level: 11 },
  { id: 'cortez', name: 'Cortez', kind: 'town', x: 28, y: 67.5, region: 'Four Corners', blurb: 'Staging for the desert. Ute Mountain watches every convoy.', level: 10 },
  { id: 'mesa-verde', name: 'Mesa Verde', kind: 'landmark', x: 30.5, y: 69.5, region: 'Four Corners', blurb: 'Cliff Palace in the alcove. Eight centuries of holding high ground.', landmarkBonus: 'Ruins cover', level: 10 },
  { id: 'four-corners', name: 'Four Corners Monument', kind: 'landmark', x: 24, y: 74, region: 'Four Corners', blurb: 'One foot in four states. The Lattice border is thinnest here.', landmarkBonus: 'Crossroads ritual site', level: 10 },
  { id: 'durango', name: 'Durango', kind: 'city', x: 34, y: 74.5, region: 'San Juans', blurb: 'Narrow-gauge steam and broad ambitions. The Animas runs like current.', level: 10 },
  { id: 'pagosa', name: 'Pagosa Springs', kind: 'town', x: 43, y: 73.5, region: 'San Juans', blurb: 'Deepest hot springs on earth. Soak the carbon ache away.', level: 9 },
  { id: 'wolf-creek', name: 'Wolf Creek Pass', kind: 'landmark', x: 46.5, y: 69.5, region: 'San Juans', blurb: 'Most snow in Colorado. Whiteout tiles hide everything.', landmarkBonus: 'Snow concealment', level: 9 },
  { id: 'alamosa', name: 'Alamosa', kind: 'town', x: 53, y: 69.5, region: 'San Luis Valley', blurb: 'High desert hub. Adams State radio reads the static like scripture.', level: 8 },
  { id: 'sand-dunes', name: 'Great Sand Dunes', kind: 'landmark', x: 56, y: 71.5, region: 'San Luis Valley', blurb: 'Star dunes singing in the wind. Synthesis sand — pure feedstock.', landmarkBonus: 'Synthesis +1 range', level: 8 },
  { id: 'creede', name: 'Creede', kind: 'town', x: 47, y: 63.5, region: 'San Juans', blurb: 'Old silver camp in a cliff crack. Repertory theatre does war propaganda.', level: 10 },
  { id: 'lake-city', name: 'Lake City', kind: 'town', x: 44, y: 59.5, region: 'San Juans', blurb: 'One road in, same road out. Alfred Packer jokes are mandatory.', level: 10 },
  { id: 'glenwood', name: 'Glenwood Springs', kind: 'town', x: 42, y: 34.5, region: 'I-70 Corridor', blurb: 'Hot springs pool, vapor caves, and a canyon that swallows convoys.', level: 12 },
  { id: 'aspen', name: 'Aspen / Maroon Bells', kind: 'landmark', x: 45, y: 41.5, region: 'Elk Range', blurb: 'Maroon Bells at dawn — most photographed, most contested.', landmarkBonus: 'Alpine lake map', level: 12 },
  { id: 'grand-junction', name: 'Grand Junction', kind: 'city', x: 18, y: 37.5, region: 'Grand Valley', blurb: 'River city, peach sheds, and the western capital of the Free Nodes.', level: 12 },
  { id: 'fruita', name: 'Fruita', kind: 'town', x: 14, y: 36.5, region: 'Grand Valley', blurb: 'Dino museum, single-track, and a fabulous state of mind.', level: 12 },
  { id: 'palisade', name: 'Palisade', kind: 'town', x: 21, y: 37.5, region: 'Grand Valley', blurb: 'Peaches and wine. Harvest crews double as lookouts.', level: 12 },
  { id: 'rifle', name: 'Rifle', kind: 'town', x: 33, y: 33.5, region: 'I-70 Corridor', blurb: 'Named for a rifle, armed to match. Falls and gaps for days.', level: 12 },
  { id: 'meeker', name: 'Meeker', kind: 'town', x: 33, y: 24.5, region: 'White River', blurb: 'Elk capital. The Meeker Massacre is still argued over coffee.', level: 13 },
  { id: 'rangely', name: 'Rangely', kind: 'town', x: 22, y: 23.5, region: 'Uinta Basin', blurb: 'Oil shale and open sky. The grid ends; the Lattice begins.', level: 13 },
  { id: 'craig', name: 'Craig', kind: 'town', x: 30, y: 17.5, region: 'Yampa Valley', blurb: 'Elk hunting capital. Power plant stacks mark the muster point.', level: 13 },
  { id: 'steamboat', name: 'Steamboat Springs', kind: 'town', x: 38, y: 17.5, region: 'Yampa Valley', blurb: 'Champagne powder, hot springs, and a very fast militia on skis.', level: 13 },
  { id: 'winter-park', name: 'Winter Park / Granby', kind: 'town', x: 56, y: 23.5, region: 'High Country', blurb: 'Ski train from Denver still runs — now armored, now late.', level: 12 },
  { id: 'grand-mesa', name: 'Grand Mesa', kind: 'landmark', x: 27, y: 41.5, region: 'Western Slope', blurb: 'Largest flat-top mountain on earth. 300 lakes, one big secret.', landmarkBonus: 'Lake tiles heal', level: 12 },
  { id: 'dinosaur', name: 'Dinosaur Natl Monument', kind: 'landmark', x: 18, y: 19.5, region: 'Uinta Basin', blurb: 'Quarry wall of bones. Old power, new war.', landmarkBonus: 'Fossil cover', level: 13 },
  { id: 'carson', name: 'Fort Carson', kind: 'base', x: 70, y: 62.5, region: 'Pikes Peak', blurb: 'Mountain Post. Armor, artillery, and the state\'s biggest gun club.', isBase: true, level: 11 },
];

export const WORLD_NODE_COUNT = WORLD_NODES.length;

const PATHS: { hwy: string; stops: string[] }[] = [
  { hwy: 'I-25', stops: ['fort-collins','loveland','longmont','thornton','denver','littleton','highlands-ranch','castle-rock','monument','academy','colorado-springs','fountain','carson','pueblo','walsenburg','aguilar','trinidad','trinidad-lake','fishers-peak'] },
  { hwy: 'I-25 W', stops: ['pueblo','pueblo-reservoir','canon-city'] },
  { hwy: 'US-50', stops: ['grand-junction','palisade','grand-mesa','montrose','black-canyon','gunnison','monarch-pass','salida','canon-city','pueblo','la-junta','bents-fort','lamar'] },
  { hwy: 'I-70', stops: ['fruita','grand-junction','palisade','rifle','glenwood','vail','dillon','eisenhower','georgetown','idaho-springs','golden','arvada','denver','aurora','dia','limon','burlington'] },
  { hwy: 'US-160', stops: ['cortez','mesa-verde','durango','pagosa','wolf-creek','alamosa','sand-dunes','walsenburg'] },
  { hwy: 'US-550', stops: ['montrose','ouray','telluride','cortez','four-corners','durango'] },
  { hwy: 'US-285', stops: ['denver','morrison','fairplay','buena-vista','salida','creede','pagosa','alamosa'] },
  { hwy: 'US-34', stops: ['granby','estes-park','loveland','greeley','fort-morgan','sterling'] },
  { hwy: 'US-40', stops: ['dinosaur','rangely','meeker','craig','steamboat','winter-park','nederland','boulder'] },
  { hwy: 'CO-9', stops: ['breck','fairplay','buena-vista','leadville','dillon'] },
  { hwy: 'CO-145', stops: ['telluride','cortez'] },
  { hwy: 'US-287', stops: ['fort-collins','greeley','brighton','commerce-city','aurora','limon'] },
  { hwy: 'CO-12', stops: ['walsenburg','spanish-peaks','la-veta-pass','trinidad'] },
  { hwy: 'CO-69', stops: ['walsenburg','westcliffe','salida'] },
  { hwy: 'US-24', stops: ['minturn','leadville','buena-vista','woodland-park','colorado-springs','limon'] },
  { hwy: 'Ute Pass', stops: ['manitou','woodland-park','cripple-creek','canon-city'] },
  { hwy: 'Pikes Hwy', stops: ['manitou','pikes-peak','garden-gods','colorado-springs','cheyenne-mtn','carson'] },
  { hwy: 'Peak to Peak', stops: ['estes-park','lyons','nederland','idaho-springs'] },
  { hwy: 'Yampa', stops: ['craig','steamboat'] },
  { hwy: 'San Juan', stops: ['ouray','lake-city','creede','wolf-creek'] },
  { hwy: 'Elk Range', stops: ['glenwood','aspen','leadville'] },
  { hwy: 'Foothills', stops: ['boulder','westminster','lakewood','littleton','morrison','red-rocks','golden'] },
  { hwy: 'Grand Valley', stops: ['fruita','grand-junction'] },
  { hwy: 'Frontage', stops: ['parker','centennial','littleton','highlands-ranch','castle-rock'] },
  { hwy: 'Plains E', stops: ['brighton','fort-morgan','sterling','pawnee'] },
  { hwy: 'Royal Gorge', stops: ['royal-gorge','canon-city'] },
  { hwy: 'Gold Belt', stops: ['cripple-creek','canon-city','florence'] },
];

function buildRoads(): RoadEdge[] {
  const ids = new Set(WORLD_NODES.map(n => n.id));
  const edges = new Map<string, RoadEdge>();
  const alias: Record<string,string> = { florence: 'canon-city', minturn: 'vail', westcliffe: 'canon-city', granby: 'winter-park' };
  for (const p of PATHS) {
    const resolved = p.stops.map(s => alias[s] ?? s).filter(s => ids.has(s));
    for (let i = 0; i < resolved.length - 1; i++) {
      const a = resolved[i], b = resolved[i+1];
      if (a === b) continue;
      const key = [a,b].sort().join('|');
      if (!edges.has(key)) edges.set(key, { a, b, highway: p.hwy });
    }
  }
  return [...edges.values()];
}

export const ROAD_EDGES: RoadEdge[] = buildRoads();

export function neighborsOf(id: string): { id: string; highway: string }[] {
  return ROAD_EDGES.filter(e => e.a === id || e.b === id).map(e => ({ id: e.a === id ? e.b : e.a, highway: e.highway }));
}

export function nodeById(id: string): WorldNode {
  return WORLD_NODES.find(n => n.id === id)!;
}

/** BFS over the road graph: node ids from a to b (inclusive), or [] when no road connects them. */
export function shortestPath(a: string, b: string): string[] {
  if (a === b) return [a];
  const prev = new Map<string, string>([[a, '']]);
  const q = [a];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of neighborsOf(cur)) {
      if (prev.has(n.id)) continue;
      prev.set(n.id, cur);
      if (n.id === b) {
        const out = [b];
        for (let k = cur; k; k = prev.get(k)!) out.unshift(k);
        return out;
      }
      q.push(n.id);
    }
  }
  return [];
}
