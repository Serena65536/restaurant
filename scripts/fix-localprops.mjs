import fs from 'node:fs';

// AGP compares the SDK path from local.properties with ANDROID_HOME/ANDROID_SDK_ROOT
// as plain strings, so it must be spelled exactly like the env var: backslash
// separators, escaped the way java.util.Properties expects.
const file = 'D:\\restaurant\\app\\android\\local.properties';
fs.writeFileSync(file, 'sdk.dir=D\\:\\\\restaurant\\\\.toolchain\\\\android-sdk\n');
console.log(fs.readFileSync(file, 'utf8'));
