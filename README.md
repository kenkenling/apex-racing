# APEX Racing

Play: https://kenkenling.github.io/apex-racing/

A browser racing game with a 2.4 km circuit, ten race-car models, automatic drifting, configurable racing-line assistance, landable jumps, a racing speed guide, and a live track map.

- **Direct Racing:** race ten trained AI opponents at the original pace.
- **Learning Campaign:** 50 rounds against rivals that start with no driving knowledge and study your completed laps.
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
completed race saved in this browser. Your fastest ghost is gold. Ghosts follow
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
