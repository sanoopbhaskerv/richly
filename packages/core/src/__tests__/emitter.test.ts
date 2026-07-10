import { describe, it, expect, vi } from 'vitest';
import { Emitter } from '../events/Emitter';

type E = { ping: string; empty: void };

describe('Emitter', () => {
  it('delivers payloads to subscribers', () => {
    const em = new Emitter<E>();
    const fn = vi.fn();
    em.on('ping', fn);
    em.emit('ping', 'hello');
    expect(fn).toHaveBeenCalledWith('hello');
  });

  it('unsubscribes via returned fn and via off()', () => {
    const em = new Emitter<E>();
    const a = vi.fn();
    const b = vi.fn();
    const offA = em.on('ping', a);
    em.on('ping', b);
    offA();
    em.off('ping', b);
    em.emit('ping', 'x');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('once() fires exactly once', () => {
    const em = new Emitter<E>();
    const fn = vi.fn();
    em.once('ping', fn);
    em.emit('ping', '1');
    em.emit('ping', '2');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
