import assert from "node:assert/strict";
import { getGeminiModelCandidates, shouldTryNextGeminiModel } from "../ai/geminiModelConfig";

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

assert.equal(shouldTryNextGeminiModel({ status: 404, message: "model not found" }), true);
assert.equal(shouldTryNextGeminiModel({ status: 401, message: "unauthorized" }), false);
assert.equal(shouldTryNextGeminiModel({ status: 403, message: "permission denied" }), false);
assert.equal(shouldTryNextGeminiModel({ status: 429, message: "quota exceeded" }), false);
assert.equal(shouldTryNextGeminiModel(new Error("Gemini API call timed out")), true);
