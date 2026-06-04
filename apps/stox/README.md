# STOX Android Release

STOX is an internal Android app for WMS operations. It is not distributed through Google Play.

The production connection path is:

```txt
STOX app -> https://api.nextbigmove.com/api/v1 -> production database
```

The app never connects directly to the database.

## Current production config

- Android package: `com.nextbigmove.stox`
- Android build profile: `production`
- Distribution mode: internal
- Android artifact type: APK
- Production API URL: `https://api.nextbigmove.com/api/v1`

These values are configured in:

- [app.json](./app.json)
- [eas.json](./eas.json)

## One-time first setup

The first EAS build has an interactive setup step because Expo needs to:

- create or link the EAS project
- add `extra.eas.projectId` into `app.json`
- create Android signing credentials

Run these commands from `apps/stox`:

```bash
npm run eas:init
npm run build:android:prod
```

Expected first-time behavior:

1. `npm run eas:init`
   - logs into Expo if needed
   - creates or links the project on EAS
   - writes `extra.eas.projectId` into `app.json`
   - run this on your local machine, not on the production server

2. `npm run build:android:prod`
   - creates an internal Android APK on EAS
   - uses the production API URL from `eas.json`
   - auto-increments Android build version remotely
   - run this on your local machine, not on the production server

## Repeat build command

After the first setup is complete, the release build command is:

```bash
npm run build:android:prod
```

## What to verify after the first build

On a real Android device:

1. Download and install the APK
2. Open STOX
3. Log in with a WMS account
4. Confirm the app can:
   - authenticate
   - load `/wms/mobile/bootstrap`
   - open Home
   - open Pick / Pack / RTS / Inventory flows

## Versioning behavior

EAS is configured to manage Android build version remotely:

- `expo.version` remains the user-facing app version
- Android `versionCode` auto-increments on each production build

That behavior is set in `eas.json` with:

- `cli.appVersionSource = remote`
- `android.autoIncrement = true`

## What this phase does not do yet

This phase does not yet provide:

- APK hosting in DigitalOcean Spaces
- WMS download page
- release metadata/history in backend
- in-app update notice

Those belong to the next release-distribution phase.
