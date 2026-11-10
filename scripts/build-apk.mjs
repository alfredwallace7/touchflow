import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const windows = process.platform === "win32";
const android = resolve("android");
const gradle = windows ? "gradlew.bat" : "gradlew";
const env = { ...process.env };
const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT ||
  (windows ? join(homedir(), "AppData", "Local", "Android", "Sdk") :
    process.platform === "darwin" ? join(homedir(), "Library", "Android", "sdk") :
      join(homedir(), "Android", "Sdk"));

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  if (!existsSync(join(android, "local.properties"))) {
    if (!existsSync(join(sdk, "platforms"))) {
      throw new Error("Android SDK not found. Install it in Android Studio's SDK Manager or set ANDROID_HOME.");
    }
    env.ANDROID_HOME = sdk;
  }
  if (!env.JAVA_HOME) {
    const localJava = resolve(".apk-tools.local", "jdk-21");
    const studioJava = windows
      ? join(env.ProgramFiles || "C:\\Program Files", "Android", "Android Studio", "jbr")
      : "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
    env.JAVA_HOME = [localJava, studioJava].find((home) => {
      const release = join(home, "release");
      return existsSync(release) &&
        /^JAVA_VERSION="2[1-4](?:[."])/m.test(readFileSync(release, "utf8"));
    }) || "";
  }
  const java = windows ? "java.exe" : "java";
  const jdk = env.JAVA_HOME ? join(env.JAVA_HOME, "bin", java) : java;
  const version = spawnSync(jdk, ["-version"], { encoding: "utf8" });
  if (version.status !== 0 || !/version "2[1-4](?:[."])/.test(version.stderr)) {
    throw new Error("Set JAVA_HOME to a JDK 21 installation. The bundled Gradle 8.14 wrapper cannot run on Java 25.");
  }

  const capacitor = resolve("node_modules", "@capacitor", "cli", "bin", "capacitor");
  if (!existsSync(capacitor)) throw new Error("Run make install to install Capacitor.");
  if (!existsSync(join(android, gradle))) {
    if (existsSync(android)) {
      throw new Error("The android directory is missing its Gradle wrapper. Move it aside to regenerate it or restore the wrapper.");
    }
    run(process.execPath, [capacitor, "add", "android"]);
  } else {
    const { appId } = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
    const buildFile = readFileSync(join(android, "app", "build.gradle"), "utf8");
    const generatedId = buildFile.match(/^\s*applicationId\s*=?\s*["']([^"']+)["']/m)?.[1];
    if (generatedId && generatedId !== appId) {
      throw new Error(`The Android project uses ${generatedId}. Move android/ aside and rerun make apk to generate it with ${appId}.`);
    }
    run(process.execPath, [capacitor, "sync", "android"]);
  }
  if (windows) run(env.ComSpec || "cmd.exe", ["/d", "/c", gradle, ":app:assembleDebug"], android);
  else run(join(android, gradle), [":app:assembleDebug"], android);

  const apk = join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  if (!existsSync(apk)) throw new Error("Gradle finished but the debug APK was not found.");
  console.log(`\nAPK ready: ${apk}`);
} catch (error) {
  console.error(`APK build failed: ${error.message}`);
  process.exitCode = 1;
}
