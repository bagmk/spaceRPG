import { describe, expect, it } from 'vitest';
import { decideCloudMerge } from '../../cloud/merge';

const local = (over = {}) => ({ totalClicks: 100, stageIdx: 3, lastSaveAt: 1000, peakEntropy: 5000, ...over });
const remote = (over = {}) => ({ stageIdx: 3, lastSaveAt: 1000, peakEntropy: 5000, ...over });

describe('C-P1/C-P2 cloud-merge decision', () => {
  it('adopts the remote save when local is a fresh/empty install (no backup needed)', () => {
    const d = decideCloudMerge(local({ totalClicks: 0, stageIdx: 0 }), remote({ stageIdx: 5, lastSaveAt: 50 }));
    expect(d).toMatchObject({ hydrate: true, backupLocal: false, reason: 'local-empty' });
  });

  it('adopts a strictly-newer remote and backs up local first', () => {
    const d = decideCloudMerge(local({ lastSaveAt: 1000 }), remote({ lastSaveAt: 2000 }));
    expect(d).toMatchObject({ hydrate: true, backupLocal: true, reason: 'remote-newer' });
  });

  it('keeps local when its timestamp is newer than (or equal to) remote', () => {
    expect(decideCloudMerge(local({ lastSaveAt: 3000 }), remote({ lastSaveAt: 2000 })).reason).toBe('keep-local-newer');
    expect(decideCloudMerge(local({ lastSaveAt: 2000 }), remote({ lastSaveAt: 2000 })).hydrate).toBe(false);
  });

  it('keeps local when remote regressed on BOTH stage and peak entropy, even if remote is newer', () => {
    // remote has a newer timestamp (clock skew) but is behind on both milestones
    const d = decideCloudMerge(
      local({ stageIdx: 8, peakEntropy: 1e6, lastSaveAt: 1000 }),
      remote({ stageIdx: 2, peakEntropy: 10, lastSaveAt: 9999 }),
    );
    expect(d).toMatchObject({ hydrate: false, reason: 'keep-remote-regressed' });
  });

  it('does NOT treat remote as regressed when it is behind on only ONE milestone', () => {
    // remote behind on stage but AHEAD on peak entropy + newer → adopt it
    const d = decideCloudMerge(
      local({ stageIdx: 8, peakEntropy: 100, lastSaveAt: 1000 }),
      remote({ stageIdx: 2, peakEntropy: 9999, lastSaveAt: 2000 }),
    );
    expect(d).toMatchObject({ hydrate: true, reason: 'remote-newer' });
  });

  it('treats missing timestamps as 0 (older)', () => {
    expect(decideCloudMerge(local({ lastSaveAt: undefined }), remote({ lastSaveAt: 5 })).reason).toBe('remote-newer');
    expect(decideCloudMerge(local({ lastSaveAt: 5 }), remote({ lastSaveAt: undefined })).hydrate).toBe(false);
  });
});
