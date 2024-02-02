export const cache = new WeakMap<Request, Map<string, number>>();

// TODO: are there other attributes we should pass through?
function isPassthroughAttribute(key: string) {
  if (key.startsWith("stroke-")) return true;
}

// TODO: not the most robust, but it works
export function applyPassthroughAttributes(
  body: string,
  props: Record<string, any>,
) {
  for (const [key, value] of Object.entries(props)) {
    if (!isPassthroughAttribute(key)) continue;
    if (!body.includes(`${key}="`)) continue;
    body = body.replace(new RegExp(`${key}="[^"]"`, "g"), `${key}="${value}"`);
  }
  return body;
}
