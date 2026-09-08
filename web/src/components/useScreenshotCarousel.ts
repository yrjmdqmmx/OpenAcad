import { useEffect, useRef, useState, type HTMLAttributes } from "react";

/** Shared interaction rules for the two independent homepage carousels. */
export function useScreenshotCarousel(count: number) {
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [touching, setTouching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const root = useRef<HTMLElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const rotating = count > 1 && !reducedMotion && !hovered && !focused && !touching && visible && pageVisible;
  const move = (delta: number) => setActive((index) => (index + delta + count) % count);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => setReducedMotion(media.matches);
    media.addEventListener("change", reduce);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener("change", reduce);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % count), 3000);
    return () => window.clearTimeout(timer);
  }, [active, rotating, count]);

  const rootHandlers: HTMLAttributes<HTMLElement> = {
    onPointerEnter: (event) => { if (event.pointerType === "mouse") setHovered(true); },
    onPointerLeave: (event) => { if (event.pointerType === "mouse") setHovered(false); },
    onFocusCapture: (event) => { if (event.target.matches(":focus-visible")) setFocused(true); },
    onBlurCapture: (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); },
    onKeyDown: (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setFocused(true);
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    },
  };
  const viewportHandlers: HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      suppressClick.current = false;
      setTouching(true);
    },
    onPointerMove: (event) => {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      const dx = Math.abs(event.clientX - start.x), dy = Math.abs(event.clientY - start.y);
      if (dx > 12 && dx > dy * 1.3) event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerUp: (event) => {
      const start = gesture.current;
      gesture.current = null;
      setTouching(false);
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        suppressClick.current = true;
        move(dx < 0 ? 1 : -1);
      }
    },
    onPointerCancel: () => { gesture.current = null; setTouching(false); },
    onClickCapture: (event) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    },
  };
  return { active, setActive, move, rotating, visible, root, rootHandlers, viewportHandlers };
}
