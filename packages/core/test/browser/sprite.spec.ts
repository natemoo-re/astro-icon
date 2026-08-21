import { expect, test } from "@playwright/test";

/**
 * Confirms two claims that were reasoned from source, not run in a browser:
 * that a rewritten `<use>` survives a client-hydrated island's
 * slot-capture/hydration cycle, and that a
 * `[data-astro-transition-persist]` region's exclusion from the rewrite
 * actually prevents a broken reference across a client-side navigation.
 *
 * "Renders" is checked via `getBBox()` on the `<use>`/`<svg>` itself: a
 * `<use>` whose `href` doesn't resolve to a real element still exists in
 * the DOM (an assertion like `toBeVisible()` would pass), it just paints
 * nothing - a non-zero bounding box is what actually distinguishes
 * "referenced content rendered" from "silently missing."
 */

async function bbox(locator: import("@playwright/test").Locator) {
  return locator.evaluate((el: SVGGraphicsElement) => {
    const box = el.getBBox();
    return { width: box.width, height: box.height };
  });
}

test.describe("sprite rewrite survives a client-hydrated island's slot", () => {
  test("both deduped icons render real content after Preact hydrates the island", async ({
    page,
  }) => {
    await page.goto("/island");

    const island = page.getByTestId("island");
    // Hydration replaces/re-renders the island's children - wait for the actual DOM
    // node Preact produced, not just the pre-hydration SSR markup.
    await expect(island).toHaveClass(/hydrated/);

    const icon1 = page.getByTestId("island-icon-1");
    const icon2 = page.getByTestId("island-icon-2");
    await expect(icon1).toBeAttached();
    await expect(icon2).toBeAttached();

    // Both point at the shared symbol id - confirms rewritePageSprites' dedup
    // (not just "an icon happened to render") survived hydration.
    await expect(icon1.locator("use")).toHaveAttribute(
      "href",
      "#ai-icons-square",
    );
    await expect(icon2.locator("use")).toHaveAttribute(
      "href",
      "#ai-icons-square",
    );

    const box1 = await bbox(icon1.locator("use"));
    const box2 = await bbox(icon2.locator("use"));
    expect(box1.width).toBeGreaterThan(0);
    expect(box1.height).toBeGreaterThan(0);
    expect(box2.width).toBeGreaterThan(0);
    expect(box2.height).toBeGreaterThan(0);
  });
});

test.describe("[data-astro-transition-persist] exclusion survives a real client-side navigation", () => {
  test("a persisted icon keeps rendering across a view transition to a page with no matching symbol", async ({
    page,
  }) => {
    await page.goto("/persist-a");

    const persistedIcon = page.getByTestId("persisted-icon");
    // Persisted instance must have kept its full inline body, not a <use> -
    // this is the property the [data-astro-transition-persist] exclusion exists for.
    await expect(persistedIcon.locator("use")).toHaveCount(0);
    await expect(persistedIcon.locator("rect")).toBeAttached();

    const beforeBox = await bbox(persistedIcon);
    expect(beforeBox.width).toBeGreaterThan(0);

    // Confirm the DOM node itself is what persists (Astro's transition:persist
    // contract), not just "an equivalent-looking element happens to be there."
    await page.evaluate(() => {
      (
        document.querySelector('[data-testid="persisted-icon"]') as HTMLElement
      ).dataset.marker = "same-node";
    });

    await page.click("#nav-link");
    await page.waitForURL("**/persist-b");

    const afterNav = page.getByTestId("persisted-icon");
    await expect(afterNav).toHaveAttribute("data-marker", "same-node");

    // Page B has no local symbol for "square" at all (see persist-b.astro) - if the
    // rewrite had dedupe'd the persisted instance on page A into a <use>, this is
    // exactly where it would break: a <use> surviving the swap with nothing on the
    // new page to resolve it.
    await expect(afterNav.locator("use")).toHaveCount(0);
    await expect(afterNav.locator("rect")).toBeAttached();
    const afterBox = await bbox(afterNav);
    expect(afterBox.width).toBeGreaterThan(0);
    expect(afterBox.height).toBeGreaterThan(0);
  });
});
