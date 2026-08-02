import {
  claimNextScanJob,
  completeScanJob,
  failScanJob,
  requeueInterruptedScanJobs,
  requeueScanJob,
} from './db.mjs';
import { scanImageToCards } from './openaiVision.mjs';

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

let workerRunning = false;
let workerScheduled = false;

function isRetryable(error) {
  const status = Number(error?.status);
  return !Number.isInteger(status) || status === 429 || status >= 500;
}

async function drainQueue() {
  if (workerRunning) {
    return;
  }

  workerRunning = true;
  workerScheduled = false;

  try {
    let job = claimNextScanJob();
    while (job) {
      let pauseForRetry = false;
      try {
        const result = await scanImageToCards(job.request);
        completeScanJob(job.id, result);
      } catch (error) {
        const message = error?.message || 'Could not scan the selected image.';
        if (job.attemptCount < MAX_ATTEMPTS && isRetryable(error)) {
          requeueScanJob(job.id, message);
          setTimeout(scheduleScanJobWorker, RETRY_DELAY_MS);
          pauseForRetry = true;
        } else {
          failScanJob(job.id, message);
        }
      }

      if (pauseForRetry) {
        break;
      }
      job = claimNextScanJob();
    }
  } finally {
    workerRunning = false;
  }
}

export function scheduleScanJobWorker() {
  if (workerRunning || workerScheduled) {
    return;
  }

  workerScheduled = true;
  setImmediate(() => {
    drainQueue().catch((error) => {
      workerScheduled = false;
      console.error('[scan-worker] queue failed', error);
    });
  });
}

export function startScanJobWorker() {
  requeueInterruptedScanJobs();
  scheduleScanJobWorker();
}
