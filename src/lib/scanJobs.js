export function createScanRequestId(now = Date.now(), random = Math.random()) {
  return `scan-${now.toString(36)}-${Math.floor(random * 0x100000000).toString(36)}`;
}

export function findScanJobPlaceholderIndex(cards, job) {
  if (!Array.isArray(cards) || !job) {
    return -1;
  }

  const requestId = String(job.clientRequestId || '');
  return cards.findIndex((card) => card?.scanRequestId === requestId);
}

export function isScanJobApplied(card, job) {
  return Boolean(
    card
    && job
    && card.scanRequestId === job.clientRequestId
    && card.scanStatus === 'completed',
  );
}
