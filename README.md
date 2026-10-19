# APEX Racing

Play: https://kenkenling.github.io/apex-racing/

A browser racing game with five selectable tracks, ten race-car models, automatic drifting, configurable racing-line assistance, landable jumps, a racing speed guide, and a live track map.

- **Direct Racing:** race ten balanced pros at up to 150 mph.
- **Learning Campaign:** 50 rounds against the same rivals across all tracks. They start with no driving knowledge and study your completed laps.
- **Controls:** WASD / arrow keys; 4 left, 2 right; Space restart; P or Escape pause.
- Top speed: 150 mph. Progress and settings save in each player’s browser.

## Play locally

Serve this directory, for example with `python3 -m http.server 8000`, then open http://localhost:8000/. No build step or dependencies are required.

GitHub Pages publishes the `main` branch at its root.

The game uses Three.js r128; its MIT license is in `LICENSES/three.txt`.

## Multiplayer

Open Multiplayer on the home screen. One player chooses Create Room, copies the
8-character code, and sends it to a friend. The friend opens the same game URL,
enters the code, and chooses Join Room. The host chooses Start Together.

Two human drivers share a countdown, live cars, track markers, and finish times.
Cars pass through each other. The host can restart or request a rematch with
Space. Home leaves the room. Keep both browser tabs open during the race.
Campaign progress remains separate and is stored in each browser.

Networking uses vendored PeerJS 1.5.5, its public signaling service, and a direct
WebRTC data connection. Multiplayer requires internet access; some restricted
networks may block connections. This static edition has no dedicated race server.
PeerJS is MIT licensed; see LICENSES/peerjs.txt.

## Customize your car

Choose a model, then open **Customize Car** below the track. Pick body paint,
racing-stripe color, rim color, a gloss or matte finish, and a factory, low, or
high rear wing. The garage shows a rotating preview. Each model keeps its own
look in this browser, and your friend sees that look in multiplayer. Customize
between races; appearance does not change speed or handling.

## Self Best and ghost history

Choose **Self Best** on the home screen to race transparent replays of every
completed race saved for your selected track in this browser. Your fastest ghost is gold. Ghosts follow
the recorded path, timing, jumps, and drifting; they do not collide with you.
All completed Campaign, Direct Racing, Multiplayer, and Self Best laps join
the archive. Unfinished/restarted attempts are not saved.

Runs are stored in IndexedDB with no automatic history deletion or run-count
limit. Browser storage capacity still applies. If a save fails, the game keeps
existing history and reports the error; the new run remains available in the
current tab. Clearing this site's browser data removes its archive. History
is local to each browser, not shared through GitHub or a multiplayer room.

The previous single personal-best ghost is imported on first use. Older laps
were never recorded separately and cannot be recovered. Ghost racing uses
instanced car silhouettes to keep large fields practical.

## Five tracks, one set of rivals

Use **Your Track** below the race to switch between:

- **Summer 1 recreation** (default): a point-to-point route with an elevated
  opening, downhill straight, uphill turns, a jump, and a separate finish.
- **Stunt Sprint:** 2.24 km, fourteen true straight segments and seven jumps.
- **Desert Dash:** a faster circuit with open corners and a sandy setting.
- **Alpine Switchback:** a technical layout with alternating tight turns.
- **Classic Circuit:** the original circuit, with your earlier ghost archive.

The Summer 1 route follows the developer's official first-track reference
from [PolyTrack by Kodub](https://kodub.itch.io/polytrack). Scale, road geometry,
and ramp dynamics are adapted to APEX's driving physics.

All tracks use the same ten rival models and one shared 50-round learning
campaign. Switching tracks keeps their knowledge and your campaign round.
The most advanced earlier campaign is migrated into the shared campaign;
older saves are retained. A new campaign resets learning across all tracks.
Ghost archives and best times stay separate for each track.

Pros are about 9% quicker than the previous policy in a same-track benchmark,
with a 150 mph cap. Player speed stays capped at 150 mph. Learning mastery
grows 2.6 times faster, and clean new telemetry gets 55% weight when adapting
a previously studied segment. Learning still requires completed player laps.

Steering responds sooner, front grip is stronger, rear grip is looser during
auto drift, and drift drag is lower. Walls and rival contact deflect the car,
reduce speed, shake the camera, and trigger impact feedback.

## Sound effects

Click **Sound On** in the header. Use the volume slider to adjust the mix.
Original synthesized effects include engine/gears, wind, tire squeal, takeoff,
landing, impact, countdown and finish sounds. Pause and hidden tabs mute
continuous driving effects. Volume is remembered in this browser.

## AI Train

Choose **AI Train** on the home screen to watch 250 independent drivers.
The first generation launches with full throttle and no steering knowledge.
Later generations keep successful control programs, mix them, and mutate
steering and target speeds. Fitness rewards route progress, fewer impacts,
and faster completed runs. This is local evolutionary learning rather than
a prerecorded racing line. A seeded bend test improved coverage from about
90 m to 116 m after twelve generations.

The overhead follow camera watches the leader. The panel shows generation,
active cars, best coverage, and best finish. Simulation speed can be 1×, 2×
or 4×. Space or Next Generation evolves immediately; P pauses; Home exits.
Training knowledge saves in the browser and carries between tracks. Reset
Training clears that training brain. This separate training population does
not advance your racing campaign or create player ghost recordings. Cars
are drawn with instancing so the field can contain all 250 drivers.

## Bend collision checks

Player movement is swept in steps of at most 10 ms. Local road projection
stays near the car's current section, and wall collision uses the visible
barrier height and road camber. Barriers are 3.4 m tall to catch short jumps.
Ground and airborne high-speed impacts are checked on both sides of all
five tracks. Actual browser rendering and audible sound quality still need
interactive verification.
