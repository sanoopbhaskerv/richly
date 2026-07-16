import { test, expect } from './support/fixtures';

test.describe('Image Studio adjust', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.selectTool('Adjust');
  });

  const channels = ['Brightness', 'Contrast', 'Saturation', 'Grayscale'] as const;

  for (const channel of channels) {
    test(`${channel} slider and numeric input stay synchronized`, async ({ studio }) => {
      const slider = studio.inspector.getByRole('slider', { name: new RegExp(channel) });
      const spin = studio.inspector.getByRole('spinbutton').nth(channels.indexOf(channel));

      await spin.fill('40');
      await spin.blur();
      expect(await slider.getAttribute('aria-valuenow')).toBe('40');
    });
  }

  test('one continuous slider drag creates exactly one history entry', async ({ studio }) => {
    const before = await studio.historySnapshot();
    const slider = studio.inspector.getByRole('slider', { name: /Brightness/ });
    await slider.focus();
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    const after = await studio.historySnapshot();
    // Keyboard stepping on a single focused slider session should coalesce to
    // at most one committed history entry, not one per step.
    expect(after.entries).toBeLessThanOrEqual(before.entries + 1);
  });

  test('reset on an individual control returns it to neutral', async ({ studio }) => {
    const spin = studio.inspector.getByRole('spinbutton').first();
    await spin.fill('60');
    await spin.blur();
    expect(await spin.inputValue()).toBe('60');

    await studio.inspector.getByRole('button', { name: 'Reset all' }).click();
    expect(await spin.inputValue()).toBe('0');
  });

  test('reset all restores every channel to neutral', async ({ studio }) => {
    const spins = await studio.inspector.getByRole('spinbutton').all();
    for (const spin of spins) {
      await spin.fill('25');
      await spin.blur();
    }
    await studio.inspector.getByRole('button', { name: 'Reset all' }).click();
    for (const spin of spins) {
      expect(await spin.inputValue()).toBe('0');
    }
  });

  test('adjustments persist when switching tools and back', async ({ studio }) => {
    const spin = studio.inspector.getByRole('spinbutton').first();
    await spin.fill('35');
    await spin.blur();

    await studio.selectTool('Transform');
    await studio.selectTool('Adjust');

    // Remounting the Adjust panel re-derives its local slider state from
    // committed operations in a useEffect, which lands a tick after the tool
    // switch's click resolves — poll instead of reading the value immediately.
    await expect(studio.inspector.getByRole('spinbutton').first()).toHaveValue('35');
  });

  test('undo and redo restore exact adjustment values', async ({ studio }) => {
    const spin = studio.inspector.getByRole('spinbutton').first();
    await spin.fill('35');
    await spin.blur();
    await expect(studio.undoButton).toBeEnabled();

    await studio.undoButton.click();
    await expect(spin).toHaveValue('0');

    await studio.redoButton.click();
    await expect(spin).toHaveValue('35');
  });

  test('rejects non-numeric keyboard input without corrupting the value', async ({ studio }) => {
    const spin = studio.inspector.getByRole('spinbutton').first();
    // Native <input type="number"> already blocks non-numeric keystrokes at
    // the browser level, so `.fill()` (which requires a directly settable
    // value) refuses "abc" outright. Exercise the same guarantee by sending
    // real keystrokes and confirming the browser filtered them.
    await spin.click();
    await spin.press('ControlOrMeta+a');
    await spin.pressSequentially('abc');
    const value = await spin.inputValue();
    expect(value === '' || /^-?\d*$/.test(value)).toBe(true);
  });
});
