# PakRail Live Tracker

A Vite + React web application that visualises Pakistan Railways static schedules alongside live telemetry from the PakRail live websocket feed. The dashboard provides:

- Real-time map markers that animate as trains publish new coordinates.
- Searchable list of every long-distance train with live speed, delay, and next-stop metadata.
- Detailed route timeline for the selected service, including scheduled arrival and departure times at each station.

## Getting started

```powershell
# install dependencies
npm install

# start the development server
npm run dev

# run the unit test suite
npm test
```

The development server launches on <http://localhost:5173>. Ensure outbound HTTPS websocket connections are permitted so the client can subscribe to `wss://socket.pakraillive.com`.

## Project structure

- `src/services/dataLoader.ts` loads the static JSON datapoints bundled in `/datapoints`.
- `src/services/liveData.ts` parses websocket payloads, normalises telemetry, and reconciles deltas against known routes.
- `src/hooks/useTrainData.ts` centralises app state with a small Zustand store.
- `src/components` contains the React UI building blocks (map, filters, list, details panel).
- `src/services/liveData.test.ts` exercises the delta parsing and matching logic with Vitest.

## Environment notes

The static JSON datasets are bundled at build-time for simplicity. If you later replace them with an API, adjust `loadTrainDataset` to fetch remote data before hydrating the store.
