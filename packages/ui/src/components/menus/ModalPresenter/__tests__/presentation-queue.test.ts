import { describe, expect, it } from 'vitest';
import {
  completePresentation,
  enqueuePresentation,
  getActivePresentation,
  type PresentationRender,
  subscribePresentations,
} from '../presentation-queue';

const render: PresentationRender = () => null;

describe('presentation-queue', () => {
  it('presents the head of the queue and advances in FIFO order', () => {
    enqueuePresentation('first', render);
    enqueuePresentation('second', render);

    expect(getActivePresentation()?.id).toBe('first');

    completePresentation('first');
    expect(getActivePresentation()?.id).toBe('second');

    completePresentation('second');
    expect(getActivePresentation()).toBeNull();
  });

  it('completing a non-head entry removes it without advancing the head', () => {
    enqueuePresentation('first', render);
    enqueuePresentation('second', render);

    completePresentation('second');
    expect(getActivePresentation()?.id).toBe('first');

    completePresentation('first');
    expect(getActivePresentation()).toBeNull();
  });

  it('ignores completing an unknown id', () => {
    enqueuePresentation('first', render);
    completePresentation('ghost');
    expect(getActivePresentation()?.id).toBe('first');
  });

  it('notifies subscribers on enqueue and complete', () => {
    const events: string[] = [];
    const unsubscribe = subscribePresentations(() => events.push('change'));

    enqueuePresentation('first', render);
    completePresentation('first');
    expect(events).toEqual(['change', 'change']);

    unsubscribe();
    enqueuePresentation('second', render);
    expect(events).toEqual(['change', 'change']);
  });
});
