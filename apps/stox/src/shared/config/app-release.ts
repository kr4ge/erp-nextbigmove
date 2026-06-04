import Constants from 'expo-constants';

export type InstalledStoxBuild = {
  version: string;
  buildNumber: number | null;
  label: string;
};

export function getInstalledStoxBuild(): InstalledStoxBuild {
  const version = Constants.expoConfig?.version?.trim() || 'dev';
  const rawBuildNumber = Constants.expoConfig?.android?.versionCode;
  const buildNumber = typeof rawBuildNumber === 'number' && Number.isFinite(rawBuildNumber)
    ? rawBuildNumber
    : null;

  return {
    version,
    buildNumber,
    label: buildNumber ? `${version} (${buildNumber})` : version,
  };
}
