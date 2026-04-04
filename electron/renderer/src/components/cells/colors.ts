const COLORS = ["#2383E2", "#4DAB6F", "#D9730D", "#9B59B6", "#E03E3E", "#DFAB01"];

export function getInitialColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}
