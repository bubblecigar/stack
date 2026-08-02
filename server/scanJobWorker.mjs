import {
  claimNextScanJob,
  completeScanJob,
  failScanJob,
  failStaleScanJobUploads,
  requeueInterruptedScanJobs,
  requeueScanJob,
} from './db.mjs';
import { scanImageToCards } from './openaiVision.mjs';
import {
  cleanScanUploadDirectory,
  removeScanJobImage,
} from './scanUpload.mjs';

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;
const UPLOAD_EXPIRY_SECONDS = 15 * 60;
const UPLOAD_SWEEP_INTERVAL_MS = 60_000;

let workerRunning = false;
let workerScheduled = false;
let uploadSweepTimer = null;

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
        const request = job.imagePath
          ? {
            ...job.request,
            imageBase64: (await readFile(job.imagePath)).toString('base64'),
            mimeType: job.imageMimeType,
          }
          : job.request;
        const result = await scanImageToCards(request);
        completeScanJob(job.id, result);
        await removeScanJobImage(job);
      } catch (error) {
        const message = error?.message || 'Could not scan the selected image.';
        if (job.attemptCount < MAX_ATTEMPTS && isRetryable(error)) {
          requeueScanJob(job.id, message);
          setTimeout(scheduleScanJobWorker, RETRY_DELAY_MS);
          pauseForRetry = true;
        } else {
          failScanJob(job.id, message);
          await removeScanJobImage(job);
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
  failStaleScanJobUploads(UPLOAD_EXPIRY_SECONDS);
  cleanScanUploadDirectory()
    .catch((error) => {
      console.error('[scan-upload] startup cleanup failed', error);
    })
    .finally(scheduleScanJobWorker);

  if (!uploadSweepTimer) {
    uploadSweepTimer = setInterval(() => {
      failStaleScanJobUploads(UPLOAD_EXPIRY_SECONDS);
      cleanScanUploadDirectory().catch((error) => {
        console.error('[scan-upload] cleanup failed', error);
      });
    }, UPLOAD_SWEEP_INTERVAL_MS);
    uploadSweepTimer.unref();
  }
}
import { readFile } from 'node:fs/promises';
