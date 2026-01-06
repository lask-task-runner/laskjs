import { Local } from "./environment/local.ts";
import { Effect, Prompt, SingletonPrompt, StatefulPrompt, StatelessPrompt } from "./lask.ts";
import { Logger } from "./logger.ts";

function isStatefulPrompt(prompt: Prompt): prompt is StatefulPrompt {
  return "newPrompt" in prompt && "cleanupAllPrompts" in prompt;
}

function isStatelessPrompt(prompt: Prompt): prompt is StatelessPrompt {
  return "onetimePrompt" in prompt;
}

function isSingletonPrompt(prompt: Prompt): prompt is SingletonPrompt {
  return "getPrompt" in prompt;
}

export function createEffect<P extends Prompt = Prompt>(
  name: string,
  prompt?: P,
): Effect<P> {
  const logger = new Logger(name);
  const effectPrompt: P = (prompt ?? new Local()) as P;

  if (isStatefulPrompt(effectPrompt)) {
    return Object.assign(logger, {
      newPrompt: () => Promise.resolve(effectPrompt.newPrompt()).then((fn) => fn),
    }) as unknown as Effect<P>;
  }

  if (isStatelessPrompt(effectPrompt)) {
    return Object.assign(logger, {
      runPrompt: (script: string) => effectPrompt.onetimePrompt(script),
    }) as unknown as Effect<P>;
  }

  if (isSingletonPrompt(effectPrompt)) {
    return Object.assign(logger, {
      getPrompt: () => Promise.resolve(effectPrompt.getPrompt()).then((fn) => fn),
    }) as unknown as Effect<P>;
  }

  return logger as unknown as Effect<P>;
}
