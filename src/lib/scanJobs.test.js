import {
  createScanRequestId,
  findScanJobPlaceholderIndex,
  isScanJobApplied,
} from './scanJobs';

describe('scan jobs', () => {
  it('creates stable-looking distinct request IDs', () => {
    expect(createScanRequestId(1000, 0.1)).not.toBe(createScanRequestId(1000, 0.2));
  });

  it('finds a moved placeholder by request ID before its original card ID', () => {
    const cards = [
      { id: 4, scanRequestId: 'other' },
      { id: 9, scanRequestId: 'request-1' },
    ];
    const job = {
      clientRequestId: 'request-1',
      placeholderId: 4,
    };

    expect(findScanJobPlaceholderIndex(cards, job)).toBe(1);
  });

  it('does not attach a result to a card that only reuses the placeholder ID', () => {
    expect(findScanJobPlaceholderIndex([{ id: 4 }], {
      clientRequestId: 'request-1',
      placeholderId: 4,
    })).toBe(-1);
  });

  it('recognizes a result that was already applied before acknowledgement', () => {
    expect(isScanJobApplied({
      scanRequestId: 'request-1',
      scanStatus: 'completed',
    }, {
      clientRequestId: 'request-1',
    })).toBe(true);
  });
});
