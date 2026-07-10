import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object over one editor instance (TESTING.md §3).
 * ALL locators via data-testid — never CSS classes or visible text.
 */
export class EditorPage {
  readonly root: Locator;
  readonly content: Locator;
  readonly toolbar: Locator;
  readonly statusbar: Locator;

  constructor(
    readonly page: Page,
    /** testIdPrefix of the instance: "editor" (vanilla) or "reditor" (React) on the demo page. */
    readonly prefix = 'editor'
  ) {
    this.root = page.getByTestId(`${prefix}-root`);
    this.content = page.getByTestId(`${prefix}-content`);
    this.toolbar = page.getByTestId(`${prefix}-toolbar`);
    this.statusbar = page.getByTestId(`${prefix}-statusbar`);
  }

  button(name: string): Locator {
    // Scope to this editor's root: multiple instances share tb-<name> ids.
    return this.root.getByTestId(`tb-${name}`);
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.content).toBeVisible();
  }

  /**
   * Deterministic reset: Ctrl+A+Delete keeps the first block's tag (an <h1>
   * stays an <h1>), so tests would type into whatever block the demo content
   * started with. Reset the DOM to a single empty <p> instead.
   */
  async clear(): Promise<void> {
    await this.content.click();
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.press('Delete');
    await this.content.evaluate((el) => {
      el.innerHTML = '<p><br></p>';
    });
    await this.content.click();
  }

  async type(text: string): Promise<void> {
    await this.content.click();
    await this.page.keyboard.type(text);
  }

  /**
   * Double-click selects a word — real browser selection, unlike jsdom.
   * Locator.dblclick() aims at the matched ELEMENT's center, which is usually
   * not over the word — so we compute the word's own rect and dblclick that.
   */
  async selectWord(word: string): Promise<void> {
    const point = await this.content.evaluate((el, w) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const idx = node.textContent?.indexOf(w) ?? -1;
        if (idx !== -1) {
          const r = document.createRange();
          r.setStart(node, idx);
          r.setEnd(node, idx + w.length);
          const rect = r.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }
      }
      return null;
    }, word);
    if (!point) throw new Error(`selectWord: "${word}" not found in editor content`);
    await this.page.mouse.dblclick(point.x, point.y);
  }

  async selectAll(): Promise<void> {
    await this.content.click();
    await this.page.keyboard.press('ControlOrMeta+a');
  }

  async clickButton(name: string): Promise<void> {
    await this.button(name).click();
  }

  /** Raw DOM html minus caret-filler chars (U+FEFF) — assertions target content semantics. */
  private async html(): Promise<string> {
    return (await this.content.innerHTML()).replace(/﻿/g, '');
  }

  async expectContentContains(html: string): Promise<void> {
    await expect.poll(async () => this.html()).toContain(html);
  }

  /** Regex variant — dblclick word selection may include trailing whitespace in some browsers. */
  async expectContentMatches(pattern: RegExp): Promise<void> {
    await expect.poll(async () => this.html()).toMatch(pattern);
  }

  async expectButtonActive(name: string, active = true): Promise<void> {
    await expect(this.button(name)).toHaveAttribute('aria-pressed', String(active));
  }

  async expectWordCount(text: string): Promise<void> {
    await expect(this.root.getByTestId('status-wordcount')).toHaveText(text);
  }
}
