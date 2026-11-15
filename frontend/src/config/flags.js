const known = new Set(['particles', 'cursor', 'intro', 'reveal', 'vt', 'tilt', 'marquee', 'counters']);

// Read once at startup so decorative features cannot change during a render.
const params = new URLSearchParams(window.location.search);
const requested = new Set((params.get('off') || '').split(',').map(x => x.trim()).filter(x => known.has(x)));
if (params.get('safe') === '1') known.forEach(x => requested.add(x));

export const fxOff = requested;
export const isFxOff = name => requested.has(name);
export const fxOffLabel = [...requested].join(',');
