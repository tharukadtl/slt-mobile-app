// Smoke test: proves Detox actually drives the built app on a real emulator, not just
// that it compiles. On a fresh install there's no stored session, so SplashScreen
// (src/screens/auth/SplashScreen.tsx) shows for ~2s, then auto-navigates to LoginScreen
// (src/screens/auth/LoginScreen.tsx). Neither screen has testIDs, so this matches on the
// visible text that's actually rendered rather than adding testIDs to production code.
describe('App launch', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true, delete: true});
  });

  it('shows the splash screen, then lands on the login screen', async () => {
    await expect(element(by.text('SLT Mobile App'))).toBeVisible();

    await waitFor(element(by.text('Welcome Back')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
