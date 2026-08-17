/** Parse robots.txt and decide whether GridBot may fetch a path. */

type RobotsGroup = {
  agents: string[];
  allows: string[];
  disallows: string[];
};

function parseGroups(robotsTxt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let acceptingAgents = true;

  const startGroup = (): RobotsGroup => {
    const g: RobotsGroup = { agents: [], allows: [], disallows: [] };
    groups.push(g);
    acceptingAgents = true;
    return g;
  };

  for (const raw of robotsTxt.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#")) continue;
    if (/^user-agent:/i.test(t)) {
      const value = t.split(":").slice(1).join(":").trim().toLowerCase();
      if (!current || !acceptingAgents) current = startGroup();
      if (value) current.agents.push(value);
      continue;
    }
    if (!current) continue;
    acceptingAgents = false;
    if (/^disallow:/i.test(t)) {
      const p = t.split(":").slice(1).join(":").trim();
      if (p) current.disallows.push(p);
    }
    if (/^allow:/i.test(t)) {
      const p = t.split(":").slice(1).join(":").trim();
      if (p) current.allows.push(p);
    }
  }
  return groups;
}

function longestMatch(path: string, rules: string[]): string | undefined {
  return rules
    .filter((rule) => path === rule || path.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
}

export function pathAllowedByRobots(
  robotsTxt: string,
  path: string,
  userAgent = "GridBot",
): boolean {
  const ua = userAgent.toLowerCase();
  const groups = parseGroups(robotsTxt);
  const specific = groups.find((g) => g.agents.includes(ua));
  const star = groups.find((g) => g.agents.includes("*"));
  const group = specific ?? star;
  if (!group) return true;

  const allowHit = longestMatch(path, group.allows);
  const disallowHit = longestMatch(path, group.disallows);
  if (allowHit && (!disallowHit || allowHit.length >= disallowHit.length)) {
    return true;
  }
  if (disallowHit) return false;
  return true;
}
