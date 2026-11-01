/**
 * Hides any child that doesn't fit inside `node`, so cards in a column that's too full (large
 * text size, small screen) disappear cleanly instead of spilling off the screen or being
 * squeezed down to just a header.
 */
export function fitChildren(node: HTMLElement) {
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const children = [...node.children] as HTMLElement[];
      for (const child of children) child.style.display = '';
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      let full = false;
      // Measure after each change: hiding one card gives the ones below it more room.
      for (const child of children) {
        const body = child.querySelector<HTMLElement>('.body');
        const squashed = !!body && body.scrollHeight > body.clientHeight + 2 && body.clientHeight < 3.5 * rem;
        full ||= child.getBoundingClientRect().bottom > node.getBoundingClientRect().bottom + 1;
        if (full || squashed) child.style.display = 'none';
      }
    });
  };
  const resize = new ResizeObserver(update);
  const watch = () => {
    resize.disconnect();
    resize.observe(node);
    for (const child of node.children) resize.observe(child);
    update();
  };
  // Cards rotating in and out change heights without resizing the column itself.
  const mutations = new MutationObserver(watch);
  mutations.observe(node, { childList: true, subtree: true });
  watch();
  return {
    destroy() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    },
  };
}
