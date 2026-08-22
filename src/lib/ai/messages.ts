/**
 * Neutral, provider-agnostic user-facing messages for the AI features.
 *
 * Deliberately name NO backend provider (no "Gemini", "OpenAI", "Google",
 * "model", "quota", "rate limit", "billing", "API key") - users should never be
 * able to tell which service powers a feature. A busy/slow/exhausted provider all
 * read the same calm way; the client retries transparently underneath.
 */

/** Provider is momentarily busy / overloaded / out of quota - transient, we retry. */
export const AI_BUSY = "Please wait - we're a little busy right now. Your results are coming up, please try again in a moment."

/** Feature isn't available right now (unconfigured / disabled). Says nothing about why. */
export const AI_UNAVAILABLE = "This feature isn't available right now. Please try again later."

/** A generic non-transient failure. */
export const AI_FAILED = "Something went wrong. Please try again in a moment."

/** Image generation specifically is unavailable. */
export const AI_IMAGE_UNAVAILABLE = "Image generation isn't available right now. Please try again later."
