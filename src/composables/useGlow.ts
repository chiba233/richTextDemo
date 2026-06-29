// Cursor-tracking glow for glass cards — ported from YumeLog's useCardGlow.
// Stateless across elements (rect is read per-frame from currentTarget), so a
// single handler object can be bound to many panels via `v-on`.

const ease = (t: number): number => t + (t - 0.5) * 0.1;

export const useGlow = () => {
  let raf = 0;

  const onMove = (event: MouseEvent): void => {
    const card = event.currentTarget as HTMLElement | null;
    if (!card) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      card.style.setProperty("--mx", `${ease(nx) * rect.width}px`);
      card.style.setProperty("--my", `${ease(ny) * rect.height}px`);
      card.style.setProperty("--glow", "1");
    });
  };

  const onLeave = (event: MouseEvent): void => {
    const card = event.currentTarget as HTMLElement | null;
    card?.style.setProperty("--glow", "0");
  };

  return { mousemove: onMove, mouseleave: onLeave };
};
