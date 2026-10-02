const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = vm.createContext({JSON:undefined});
vm.runInContext(fs.readFileSync(require.resolve('../DanCardCEP/jsx/dan_be_bridge.jsx'), 'utf8'), context);
const text = vm.runInContext('dcDanBeJSON.stringify({message:"Khuôn\\nBài\\t\\\"\\\\", values:[1, -2.25, true, false, null], nested:{id:"danbe_1"}})', context);
const expected = JSON.parse(text);
assert.strictEqual(expected.message, 'Khuôn\nBài\t"\\');
context.testText = text;
assert.strictEqual(vm.runInContext('dcDanBeJSON.stringify(dcDanBeJSON.parse(testText))', context), text);
for (const invalid of ['[1,]', '{"x":1,}', '1x', '{"x":function(){}}', '"\n"', '{"__proto__":{}}']) {
  context.testText = invalid;
  assert.throws(() => vm.runInContext('dcDanBeJSON.parse(testText)', context));
}
assert.strictEqual(vm.runInContext('typeof JSON', context), 'undefined');
console.log('Fresh ExtendScript-compatible engine: bridge JSON roundtrip and invalid-input checks passed.');
