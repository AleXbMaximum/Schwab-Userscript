export function ui_createElement(
  tag,
  {
    text = "",
    className = "",
    styleString = "",
    props = {},
    children = [],
    events = {},
    innerHTML = undefined,
  } = {},
) {
  const el = document.createElement(tag);

  if (text) el.textContent = text;
  if (className) el.className = className;
  if (styleString) el.style.cssText = styleString;
  if (innerHTML) el.innerHTML = innerHTML;

  Object.entries(props).forEach(([key, value]) => {
    key === "innerHTML" ? (el.innerHTML = value) : (el[key] = value);
  });

  (Array.isArray(children)
    ? children.filter(Boolean)
    : [children].filter(Boolean)
  ).forEach((child) => el.appendChild(child));

  Object.entries(events).forEach(([event, handler]) => {
    el.addEventListener(event, handler);
  });

  return el;
}
