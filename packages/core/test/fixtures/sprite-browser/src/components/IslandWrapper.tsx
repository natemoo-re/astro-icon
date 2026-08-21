import type { ComponentChildren } from "preact";

/** A minimal client-hydrated island that receives <Icon> output as slot content, to verify a rewritten <use> survives Astro's slot-capture/hydration machinery. */
export default function IslandWrapper({
  children,
}: {
  children?: ComponentChildren;
}) {
  return (
    <div data-testid="island" class="hydrated">
      {children}
    </div>
  );
}
