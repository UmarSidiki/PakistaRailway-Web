import fs from 'node:fs';
import path from 'node:path';

const trainsPath = path.join(process.cwd(), 'datapoints', 'trains.json');
const trains = JSON.parse(fs.readFileSync(trainsPath, 'utf-8')).Response;

const byNumber = new Map();
const duplicates = [];

for (const train of trains) {
  const list = byNumber.get(train.TrainNumber) ?? [];
  list.push(train);
  byNumber.set(train.TrainNumber, list);
}

for (const [number, list] of byNumber.entries()) {
  if (list.length > 1) {
    duplicates.push({
      trainNumber: number,
      entries: list.map((train) => ({
        TrainId: train.TrainId,
        TrainName: train.TrainName,
        IsUp: train.IsUp,
        LocomotiveNumber: train.LocomotiveNumber
      }))
    });
  }
}

console.log(JSON.stringify({ duplicateCount: duplicates.length, duplicates }, null, 2));
