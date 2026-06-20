# Google Play Data safety draft

This draft matches the v1.6.0 Android manifest and runtime. Recheck it after
every SDK, analytics, advertising, account, or network change.

## Collection and sharing

- Does the app collect or share any required user data types? **No**
- Is all user data encrypted in transit? **Not applicable; the app does not
  transmit user data**
- Can users request deletion? **Yes. Settings → Data → Reset all player data,
  or uninstall the app**
- Does the app provide accounts? **No**

## Local-only information

The app stores these values only in its private WebView storage:

- campaign and Daily Flock progress
- active checkpoint
- achievements and player statistics
- sound, haptic, visual-effect, and theme preferences
- tutorial completion
- local recovery copies
- a bounded local closed-test diagnostic log

These values are not transmitted off the device. Android cloud backup and
device-transfer backup are disabled in the manifest. A player may explicitly export a JSON backup or a privacy-safe tester report
through the Android document picker. Neither file is transmitted by the app;
the player chooses where to save or share it.

## SDK review

Included Android library:

- `androidx.webkit:webkit:1.16.0`

AndroidX libraries do not send user data to a backend. The app contains no
advertising, analytics, crash-reporting, billing, account, or social SDK.

## Revalidation trigger

Update this form before release if any future build adds:

- analytics or crash reporting
- online leaderboards or cloud saves
- accounts
- advertisements
- billing
- notifications
- remote configuration
- any network permission
