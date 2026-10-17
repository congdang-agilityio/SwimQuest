"use client";

import { useEffect, useRef } from "react";

/** On a phone the map scrolls sideways: start with the team's ship in view. Renders nothing visible. */
export function ScrollToShip() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>("[data-map-scroll]");
    const ship = scroller?.querySelector<HTMLElement>('[data-testid="ship"]');
    if (!scroller || !ship || scroller.scrollWidth <= scroller.clientWidth) return;
    const box = scroller.getBoundingClientRect();
    const at = ship.getBoundingClientRect();
    scroller.scrollLeft += at.left + at.width / 2 - (box.left + box.width / 2);
  }, []);
  return <span ref={ref} hidden />;
}
