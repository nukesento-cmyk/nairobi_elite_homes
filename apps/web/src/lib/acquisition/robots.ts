type Rule = { allow: boolean; pattern: string };

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/**
 * Whether robots.txt lets this agent read the path. A group naming the agent replaces the "*"
 * group, and the longest matching rule wins, with allow winning a tie.
 */
export function robotsAllows(robotsTxt: string, agent: string, path: string): boolean {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current && value) {
      current.rules.push({ allow: field === "allow", pattern: value });
    }
  }

  const name = agent.toLowerCase();
  const specific = groups.filter((group) => group.agents.some((a) => a !== "*" && name.includes(a)));
  const applicable = specific.length > 0 ? specific : groups.filter((group) => group.agents.includes("*"));

  let best: Rule | null = null;
  for (const rule of applicable.flatMap((group) => group.rules)) {
    if (!matches(rule.pattern, path)) continue;
    const longer = !best || rule.pattern.length > best.pattern.length;
    if (longer || (rule.pattern.length === best!.pattern.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}
