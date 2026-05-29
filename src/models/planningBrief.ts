import { analyzeCommand } from "./ruleRouter.js";
import type { CollaborationContext } from "./base.js";
import type { HybridRoutingResult, RoutingDecision } from "./routingTypes.js";

export interface PlanningBriefInput {
  command: string;
  collaboration?: CollaborationContext;
  routing?: HybridRoutingResult;
}

export interface ParsedIntent {
  goals: string[];
  searchQuery?: string;
  targetSite?: string;
  wantsYoutube: boolean;
  wantsGoogleSearch: boolean;
  wantsLogin: boolean;
  wantsFirstResult: boolean;
}

const STEP_CATALOG = `
Available step types (use only these):
- goto: { "type":"goto", "url":"https://..." }
- type: { "type":"type", "selector":"...", "value":"text to enter" }
- press_key: { "type":"press_key", "value":"Enter", "selector":"textarea[name=\\"q\\"]" }  // selector optional but preferred after type
- wait: { "type":"wait", "timeoutMs": 2000 }
- click: { "type":"click", "selector":"..." }  // only if selector is stable
- click_href: { "type":"click_href", "value":"domain.com/path" }  // open first link whose URL contains value
- open_first_youtube: { "type":"open_first_youtube" }  // after Google search — opens first YouTube watch link (preferred for YouTube)
- extract_text: { "type":"extract_text", "selector":"..." }
- captcha_checkpoint: { "type":"captcha_checkpoint", "value":"message for human" }
`.trim();

const SITE_RULES = `
Site-specific rules (mandatory):
- Google search input: textarea[name="q"] — never input[name=q]
- After Google search: press_key Enter, then wait at least 3000ms before clicking results
- First YouTube from Google: use open_first_youtube — never #rso, nth-child, or data-ved selectors
- Generic first link: click_href with href fragment, not guessed CSS paths
- Before login forms or payment: add captcha_checkpoint step
- Prefer 4–10 clear steps; break complex tasks into logical phases
`.trim();

export function parseIntent(command: string): ParsedIntent {
  const normalized = command.toLowerCase();
  const goals: string[] = [];

  if (/search|look up|find/i.test(command)) {
    goals.push("Perform a web search");
  }
  if (/open|go to|navigate|visit/i.test(command)) {
    goals.push("Navigate to a website or page");
  }
  if (/click|press|select/i.test(command)) {
    goals.push("Interact with a UI element");
  }
  if (/login|sign in|log in/i.test(command)) {
    goals.push("Authenticate on a site");
  }
  if (/youtube|youtu\.be/i.test(command)) {
    goals.push("Work with YouTube content");
  }
  if (/read|extract|get text|summarize/i.test(command)) {
    goals.push("Read or extract information from the page");
  }
  if (goals.length === 0) {
    goals.push("Complete the user request in the browser");
  }

  return {
    goals,
    searchQuery: extractSearchQuery(command),
    targetSite: extractTargetSite(normalized),
    wantsYoutube: /youtube|youtu\.be|first.*video/i.test(normalized),
    wantsGoogleSearch: /google/i.test(normalized) && /search/i.test(normalized),
    wantsLogin: /login|sign in|log in/i.test(normalized),
    wantsFirstResult: /first (link|result|video|site)/i.test(normalized)
  };
}

export function buildPlanningBrief(input: PlanningBriefInput): string {
  const intent = parseIntent(input.command);
  const ruleAnalysis =
    input.routing?.ruleAnalysis ?? analyzeCommand(input.command);

  const sections: string[] = [
    "# Browser automation planning brief",
    "",
    "## Original user command",
    input.command.trim(),
    "",
    "## Interpreted goals",
    ...intent.goals.map((g) => `- ${g}`),
    ""
  ];

  if (intent.searchQuery) {
    sections.push("## Extracted search query", `"${intent.searchQuery}"`, "");
  }

  sections.push(
    "## Task decomposition (execute in this order)",
    buildDecomposition(intent),
    "",
    "## Rule analyzer signals",
    `- Planning: ${ruleAnalysis.signals.planning.toFixed(2)}`,
    `- Vision: ${ruleAnalysis.signals.vision.toFixed(2)}`,
    `- Writing: ${ruleAnalysis.signals.writing.toFixed(2)}`,
    `- Confidence: ${ruleAnalysis.confidence.toFixed(2)}`,
    ...ruleAnalysis.reasons.map((r) => `- ${r}`),
    ""
  );

  if (input.routing?.decisions.length) {
    sections.push(
      "## Assigned model team (for context only — you produce the steps)",
      ...input.routing.decisions.map(
        (d) =>
          `- ${d.role}: ${d.modelId} (${d.method}) — ${d.reason}`
      ),
      ""
    );
    if (input.routing.orchestratorNote) {
      sections.push("## Orchestrator note", input.routing.orchestratorNote, "");
    }
  }

  const collab = input.collaboration;
  if (
    collab?.reasonerNotes ||
    collab?.visionSummary ||
    collab?.writerHints
  ) {
    sections.push("## Specialist notes (from other models)");
    if (collab.reasonerNotes) {
      sections.push("### Reasoning", collab.reasonerNotes, "");
    }
    if (collab.visionSummary) {
      sections.push("### Vision", collab.visionSummary, "");
    }
    if (collab.writerHints) {
      sections.push("### Writing", collab.writerHints, "");
    }
  }

  sections.push(
    "## Step type reference",
    STEP_CATALOG,
    "",
    "## Hard constraints",
    SITE_RULES,
    "",
    "## Output requirements",
    "- Return ONLY valid JSON: {\"steps\":[...]}",
    "- Each step must be executable by Playwright without human help except captcha_checkpoint",
    "- Include enough wait steps after navigation and search",
    "- Be specific with selectors only when reliable; otherwise use open_first_youtube or click_href",
    ""
  );

  return sections.join("\n");
}

function buildDecomposition(intent: ParsedIntent): string {
  const lines: string[] = [];

  if (intent.wantsGoogleSearch && intent.searchQuery) {
    lines.push("1. Open Google");
    lines.push(`2. Enter search text: "${intent.searchQuery}"`);
    lines.push("3. Submit search (Enter) and wait for results to load");
    if (intent.wantsYoutube) {
      lines.push("4. Open the first YouTube video result (use open_first_youtube)");
    } else if (intent.wantsFirstResult) {
      lines.push("4. Open the first relevant search result link");
    } else {
      lines.push("4. Complete any remaining action on the results page");
    }
    return lines.join("\n");
  }

  if (intent.wantsLogin) {
    lines.push("1. Navigate to the login page");
    lines.push("2. captcha_checkpoint if needed");
    lines.push("3. Fill credentials (user may need to assist)");
  }

  intent.goals.forEach((g, i) => {
    lines.push(`${i + 1}. ${g}`);
  });

  return lines.join("\n");
}

function extractSearchQuery(command: string): string | undefined {
  const patterns = [
    /search(?:\s+for)?\s+(.+?)(?:\s+and\s+open|\s+then\s+open|$)/i,
    /search\s+(.+?)(?:\s+and|\s+then|$)/i,
    /google\s+and\s+search\s+(.+?)(?:\s+and|\s+then|$)/i
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\s+and\s+open.*$/i, "")
        .replace(/\s+open\s+the\s+first.*$/i, "")
        .trim();
    }
  }

  return undefined;
}

function extractTargetSite(normalized: string): string | undefined {
  if (normalized.includes("google")) {
    return "google.com";
  }
  if (normalized.includes("youtube")) {
    return "youtube.com";
  }
  const urlMatch = normalized.match(/https?:\/\/[^\s]+/);
  return urlMatch?.[0];
}

export function formatRoutingSummary(decisions: RoutingDecision[]): string {
  return decisions
    .map((d) => `${d.role}=${d.modelId} (${d.method})`)
    .join(", ");
}
