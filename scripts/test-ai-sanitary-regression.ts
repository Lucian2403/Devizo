import assert from "node:assert/strict";
import { hasStrongConflict, tagText } from "../domain/ai/concepts";

function assertSanitaryMixer(text: string): void {
  const tags = tagText(text);
  assert.ok(tags.objects.has("sanitaryware"), `Expected sanitaryware for: ${text}`);
  assert.ok(tags.actions.has("install"), `Expected install action for: ${text}`);
  assert.equal(hasStrongConflict("install", "sanitaryware", tags), false);
}

assertSanitaryMixer("Montare baterie Remer");
assertSanitaryMixer("Montare baterie sanitară Remer");
assertSanitaryMixer("Montare robinet lavoar");
assertSanitaryMixer("Установка смесителя");

const drillBattery = tagText("Montare acumulator litiu 18V pentru sculă");
assert.equal(drillBattery.objects.has("sanitaryware"), false);

const radiatorBattery = tagText("Montare baterie calorifer");
assert.equal(radiatorBattery.objects.has("sanitaryware"), false);

console.log("AI sanitary mixer regression tests: ok");
