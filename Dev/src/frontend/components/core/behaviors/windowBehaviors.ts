export function ui_makeDraggable(handle, container) {
  let shiftX = 0,
    shiftY = 0;
  let latestX = 0,
    latestY = 0;
  let animationFrameId = null;

  const updatePosition = () => {
    const isExpanded = container.classList.contains("dock-expanded");
    if (isExpanded) {
      animationFrameId = null;
      return;
    }

    let newLeft = latestX - shiftX;
    let newTop = latestY - shiftY;

    container.style.transition = "none";
    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
    animationFrameId = null;
  };

  const onMouseMove = (e) => {
    e.preventDefault();
    latestX = e.clientX;
    latestY = e.clientY;

    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(updatePosition);
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    container.style.transition = "all 0.3s ease";
    handle.style.cursor = "grab";
    document.body.style.cursor = "default";
    container.setAttribute("data-was-dragged", "true");
  };

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    shiftX = e.clientX - rect.left;
    shiftY = e.clientY - rect.top;
    handle.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

export function ui_toggleMinimize(container, uiElements) {
  const isMinimized = container.classList.contains("dock-minimized");

  requestAnimationFrame(() => {
    if (isMinimized) {
      // Expand — CSS removes .dock-minimized rules, all elements reappear
      container.classList.remove("dock-minimized");
      container.classList.add("dock-expanded");
      container.setAttribute("aria-expanded", "true");

      uiElements.toggleBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>';
      uiElements.toggleBtn.setAttribute("aria-label", "Minimize");

      // Pin to origin when expanded
      container.style.left = "0";
      container.style.top = "0";
    } else {
      // Minimize — CSS .dock-minimized hides header children + content
      container.classList.add("dock-minimized");
      container.classList.remove("dock-expanded");
      container.setAttribute("aria-expanded", "false");

      uiElements.toggleBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
      uiElements.toggleBtn.setAttribute("aria-label", "Expand");
    }
  });
}
