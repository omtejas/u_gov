import assert from "node:assert/strict";
import { getGeminiModelCandidates } from "../ai/geminiModelConfig";

assert.deepEqual(getGeminiModelCandidates(), [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
]);
assert.deepEqual(getGeminiModelCandidates("gemini-2.5-flash"), [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
]);
assert.deepEqual(getGeminiModelCandidates("models/gemini-3.7-flash"), [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
]);
assert.deepEqual(getGeminiModelCandidates("custom-model"), [
  "gemini-3.8-flash",
  "custom-model",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
]);
assert.deepEqual(getGeminiModelCandidates("bad/model?key=secret"), [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
]);
console.log("Gemini model configuration tests passed.");
