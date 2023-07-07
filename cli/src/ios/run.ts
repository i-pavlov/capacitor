import Debug from 'debug';
import path, { basename, resolve } from 'path';

import c from '../colors';
import { promptForPlatformTarget, runTask } from '../common';
import type { Config } from '../definitions';
import type { RunCommandOptions } from '../tasks/run';
import { runNativeRun, getPlatformTargets } from '../util/native-run';
import { runCommand } from '../util/subprocess';

const debug = Debug('capacitor:ios:run');

export async function runIOS(
  config: Config,
  { target: selectedTarget, scheme: selectedScheme }: RunCommandOptions,
): Promise<void> {
  const bazelLabel = config.ios.bazelLabel;
  if (bazelLabel !== undefined) {
    await runWithBazel(config, bazelLabel);
  } else {
    await runWithXCBuild(
      config,
      {target: selectedTarget, scheme: selectedScheme}
    )
  }
}

async function runWithXCBuild(
  config: Config,
  { target: selectedTarget, scheme: selectedScheme}: RunCommandOptions,
): Promise<void> {
  const target = await promptForPlatformTarget(
    await getPlatformTargets('ios'),
    selectedTarget,
  );

  const runScheme = selectedScheme || config.ios.scheme;

  const derivedDataPath = resolve(
    config.ios.platformDirAbs,
    'DerivedData',
    target.id,
  );

  const xcodebuildArgs = [
    '-workspace',
    basename(await config.ios.nativeXcodeWorkspaceDirAbs),
    '-scheme',
    runScheme,
    '-configuration',
    'Debug',
    '-destination',
    `id=${target.id}`,
    '-derivedDataPath',
    derivedDataPath,
  ];

  debug('Invoking xcodebuild with args: %O', xcodebuildArgs);

  await runTask('Running xcodebuild', async () =>
    runCommand('xcrun', ['xcodebuild', ...xcodebuildArgs], {
      cwd: config.ios.nativeProjectDirAbs,
    }),
  );

  const appName = `${runScheme}.app`;
  const appPath = resolve(
    derivedDataPath,
    'Build/Products',
    target.virtual ? 'Debug-iphonesimulator' : 'Debug-iphoneos',
    appName,
  );

  const nativeRunArgs = ['ios', '--app', appPath, '--target', target.id];

  debug('Invoking native-run with args: %O', nativeRunArgs);

  await runTask(
    `Deploying ${c.strong(appName)} to ${c.input(target.id)}`,
    async () => runNativeRun(nativeRunArgs),
  );
}

async function runWithBazel(
  config: Config,
  bazelLabel: string,
): Promise<void> {
  const bazeliskPath = path.join(config.app.rootDir, "bazelisk");
  debug('Detected bazelisk at %0', bazeliskPath);
  const bazeliskArgs = [
    "run",
    bazelLabel
  ];
  debug('Invoking bazelisk with args: %0', bazeliskArgs);
  await runTask('Running bazel', async () =>
    runCommand(bazeliskPath, bazeliskArgs, {
      cwd: config.ios.nativeProjectDirAbs,
    }),
  );
}

