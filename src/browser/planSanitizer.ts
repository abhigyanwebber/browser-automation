import type { TaskStep } from "../types.js";

/** Fix common LLM selector mistakes (e.g. Google search box, result links) */
export function sanitizePlan(steps: TaskStep[], command = ""): TaskStep[] {
  const normalized = command.toLowerCase();
  const wantsYoutube =
    normalized.includes("youtube") || normalized.includes("youtu.be");
  const wantsFirstLink =
    wantsYoutube ||
    /first (link|result|video|site)/i.test(command) ||
    /open the first/i.test(command);

  let result: TaskStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = { ...steps[i] };

    if (step.type === "type" && step.selector) {
      if (
        step.selector.includes("input[name=q]") ||
        step.selector === 'input[name="q"]'
      ) {
        step.selector = 'textarea[name="q"], input[name="q"]';
      }

      const next = steps[i + 1];
      const isGoogleSearchClick =
        next?.type === "click" &&
        next.selector &&
        /btnK|search|submit/i.test(next.selector);

      result.push(step);
      if (isGoogleSearchClick) {
        result.push({
          type: "press_key",
          value: "Enter",
          selector: step.selector
        });
        result.push({ type: "wait", timeoutMs: 3000 });
        i += 1;
      }
      continue;
    }

    if (step.type === "click" && step.selector?.includes("input[name=btnK]")) {
      const prev = result[result.length - 1];
      result.push({
        type: "press_key",
        value: "Enter",
        selector:
          prev?.type === "type" && prev.selector ? prev.selector : undefined
      });
      result.push({ type: "wait", timeoutMs: 3000 });
      continue;
    }

    if (
      step.type === "press_key" &&
      step.value === "Enter" &&
      !step.selector
    ) {
      const prev = result[result.length - 1];
      if (prev?.type === "type" && prev.selector) {
        step.selector = prev.selector;
      }
      result.push(step);
      result.push({ type: "wait", timeoutMs: 3000 });
      continue;
    }

    if (step.type === "press_key" && step.value === "Enter") {
      result.push(step);
      const next = steps[i + 1];
      if (next?.type === "wait") {
        if ((next.timeoutMs ?? 0) < 2500) {
          result.push({ type: "wait", timeoutMs: 3000 });
        }
        i += 1;
      } else {
        result.push({ type: "wait", timeoutMs: 3000 });
      }
      continue;
    }

    if (step.type === "click" && isFragileGoogleResultClick(step.selector)) {
      if (wantsYoutube) {
        result.push(youtubeOpenStep());
        continue;
      }
    }

    result.push(step);
  }

  if (
    wantsYoutube &&
    !result.some(
      (s) =>
        s.type === "click_href" ||
        s.type === "vision_click" ||
        s.type === "open_first_youtube"
    )
  ) {
    const lastWait = result.at(-1);
    if (lastWait?.type !== "wait") {
      result.push({ type: "wait", timeoutMs: 3000 });
    }
    result.push(youtubeOpenStep());
  }

  return result;
}

function youtubeOpenStep(): TaskStep {
  return { type: "open_first_youtube" };
}

function isFragileGoogleResultClick(selector?: string): boolean {
  if (!selector) {
    return false;
  }
  return (
    selector.includes("#rso") ||
    selector.includes("nth-child") ||
    selector.includes("Yu2jwc") ||
    selector.includes("data-ved")
  );
}
