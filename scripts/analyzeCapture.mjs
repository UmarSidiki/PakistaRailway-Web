import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const capturesDir = path.join(root, 'datapoints', 'captures');

const captureArg = process.argv[2];

function findLatestCapture(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
  if (files.length === 0) {
    return null;
  }
  const sorted = files
    .map((name) => ({ name, time: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  return path.join(dir, sorted[0].name);
}

const capturePath = captureArg ? path.resolve(captureArg) : findLatestCapture(capturesDir);

if (!capturePath || !fs.existsSync(capturePath)) {
  console.error('No capture file found.');
  process.exit(1);
}

const trainsPath = path.join(root, 'datapoints', 'trains.json');
if (!fs.existsSync(trainsPath)) {
  console.error('trains.json not found');
  process.exit(1);
}

const capture = JSON.parse(fs.readFileSync(capturePath, 'utf-8'));
const trains = JSON.parse(fs.readFileSync(trainsPath, 'utf-8')).Response;

const trainsByNumber = new Map(trains.map((train) => [train.TrainNumber, train]));
const trainsById = new Map(trains.map((train) => [train.TrainId, train]));
const trainsByName = new Map(trains.map((train) => [train.TrainName.toLowerCase(), train]));
const trainsByLocomotive = new Map(
  trains.filter((train) => train.LocomotiveNumber).map((train) => [train.LocomotiveNumber, train])
);

const entries = [];

const flattenEnvelope = (envelope) => {
  Object.entries(envelope).forEach(([trainKey, variants]) => {
    Object.entries(variants).forEach(([variantKey, payload]) => {
      entries.push({ trainKey, variantKey, payload });
    });
  });
};

(capture.events ?? []).forEach((event) => {
  if (event && event.payload && typeof event.payload === 'object') {
    flattenEnvelope(event.payload);
  }
});

const summary = {
  capturePath,
  totalEvents: capture.events?.length ?? 0,
  totalEntries: entries.length,
  matches: {
    byTrainNumber: 0,
    byId: 0,
    byLocomotive: 0,
    byDerivedKey: 0
  },
  unresolvedSamples: [],
  duplicateDerivedNumbers: {}
};
const derivedCounts = new Map();

const deriveTrainNumberFromKey = (value) => {
  if (typeof value !== 'string') return null;
  if (value.endsWith('9900')) {
    const core = value.slice(0, -4);
    const num = Number(core);
    return Number.isFinite(num) ? num : null;
  }
  if (value.endsWith('099900')) {
    const core = value.slice(0, -6);
    const num = Number(core);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

for (const entry of entries) {
  const payload = entry.payload;
  const spNumber = payload?.sp ? Number(payload.sp) : null;
  const nextStation = payload?.next_station ? Number(payload.next_station) : null;
  const prevStation = payload?.prev_station ? Number(payload.prev_station) : null;
  const locomitiveNo = payload?.locomitiveNo ?? null;

  const record = {
    trainKey: entry.trainKey,
    variantKey: entry.variantKey,
    sp: spNumber,
    nextStation,
    prevStation,
    locomitiveNo,
    trainNumberMatch: null,
    trainIdMatch: null,
    locomotiveMatch: null,
    derivedKeyMatch: null
  };

  const byNumber = spNumber != null ? trainsByNumber.get(spNumber) : undefined;
  if (byNumber) {
    summary.matches.byTrainNumber += 1;
    record.trainNumberMatch = { TrainId: byNumber.TrainId, TrainNumber: byNumber.TrainNumber, TrainName: byNumber.TrainName };
  }

  const trainKeyNumber = Number(entry.trainKey);
  if (Number.isFinite(trainKeyNumber)) {
    const byId = trainsById.get(trainKeyNumber) ?? trainsByNumber.get(trainKeyNumber);
    if (byId) {
      summary.matches.byId += 1;
      record.trainIdMatch = { TrainId: byId.TrainId, TrainNumber: byId.TrainNumber, TrainName: byId.TrainName };
    }
  }

  const derivedNumber = deriveTrainNumberFromKey(entry.trainKey) ?? deriveTrainNumberFromKey(entry.variantKey);
  if (derivedNumber != null) {
    const derivedMatch = trainsByNumber.get(derivedNumber);
    if (derivedMatch) {
      summary.matches.byDerivedKey += 1;
      record.derivedKeyMatch = {
        TrainId: derivedMatch.TrainId,
        TrainNumber: derivedMatch.TrainNumber,
        TrainName: derivedMatch.TrainName,
        derivedNumber
      };
    }

    derivedCounts.set(derivedNumber, (derivedCounts.get(derivedNumber) ?? 0) + 1);
  }

  if (locomitiveNo && trainsByLocomotive.has(locomitiveNo)) {
    const byLoco = trainsByLocomotive.get(locomitiveNo);
    summary.matches.byLocomotive += 1;
    record.locomotiveMatch = {
      TrainId: byLoco.TrainId,
      TrainNumber: byLoco.TrainNumber,
      TrainName: byLoco.TrainName,
      LocomotiveNumber: byLoco.LocomotiveNumber
    };
  }

  if (!record.trainNumberMatch && !record.trainIdMatch && !record.locomotiveMatch && !record.derivedKeyMatch) {
    summary.unresolvedSamples.push(record);
  }
}

summary.unresolvedSamples = summary.unresolvedSamples.slice(0, 10);

summary.duplicateDerivedNumbers = Object.fromEntries(
  [...derivedCounts.entries()].filter(([, count]) => count > 1)
);

console.log(JSON.stringify(summary, null, 2));
