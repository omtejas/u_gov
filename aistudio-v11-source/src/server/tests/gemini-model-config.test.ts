import assert from "node:assert/strict";
import { getGeminiModelCandidates, shouldTryNextGeminiModel } from "../ai/geminiModelConfig";

assert.deepEqual(getGeminiModelCandidates(), [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
]);
assert.deepEqual(getGeminiModelCandidates("gemini-2.5-flash"), [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
]);
assert.deepEqual(getGeminiModelCandidates("gemini-1.5-pro"), [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
]);
assert.deepEqual(getGeminiModelCandidates("models/gemini-3.1-flash-lite"), [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
]);
assert.deepEqual(getGeminiModelCandidates("custom-model"), [
  "gemini-4-hydrogen",
  "custom-model",
  "gemini-3.1-flash-lite",
]);
assert.deepEqual(getGeminiModelCandidates("bad/model?key=secret"), [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
]);
console.log("Gemini model configuration tests passed.");

assert.equal(shouldTryNextGeminiModel({ status: 404, message: "model not found" }), true);
assert.equal(shouldTryNextGeminiModel({ status: 401, message: "unauthorized" }), false);
assert.equal(shouldTryNextGeminiModel({ status: 403, message: "permission denied" }), false);
assert.equal(shouldTryNextGeminiModel({ status: 429, message: "quota exceeded" }), false);
assert.equal(shouldTryNextGeminiModel(new Error("Gemini API call timed out")), true);
