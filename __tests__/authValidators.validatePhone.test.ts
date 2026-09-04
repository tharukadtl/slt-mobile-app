/**
 * AUTH-001 — validatePhone() must accept a 10-digit Sri Lankan mobile number and reject
 * everything else.
 *
 * <p>Where the function lives. The sheet's Tool column says PyTest and maps this row to
 * `test_auth_validators.py::test_validate_phone`, but there is no `validate_phone` anywhere in
 * the Python module (`slt-ai-module` is the ML/Flask service and has no auth code at all —
 * `utils/validators.py` covers GPS coords, dates, categories and forecast params only). The
 * pre-condition the row states, "validatePhone() importable", matches exactly one function in
 * this repo: `validatePhone` in SLTMobileApp/src/utils/validators.ts, which the login screen
 * calls on every keystroke. That is what is tested here, in this module's own Jest runner.
 *
 * <p>The backend enforces the identical rule independently, as a Bean Validation constraint —
 * `@Pattern(regexp = "^07[0-9]{8}$")` on `OtpLoginRequest.phoneNumber` and
 * `OtpVerifyRequest.phoneNumber` — so the client-side check below is a UX guard in front of a
 * server-side rule, not the only line of defence.
 */
import {validatePhone} from '@utils/validators';

describe('validatePhone — Sri Lankan 10-digit mobile format', () => {
  it('accepts a valid 10-digit SL mobile number', () => {
    // Step 1 / Test Data: the canonical valid number.
    expect(validatePhone('0717730773')).toBe(true);
  });

  it('rejects a number that is too short', () => {
    // Step 2: 6 digits.
    expect(validatePhone('071773')).toBe(false);
  });

  it('rejects an empty string', () => {
    // Step 3.
    expect(validatePhone('')).toBe(false);
  });

  it('rejects an international-format number', () => {
    // Step 4: a +44 UK number must not pass a Sri-Lanka-only check.
    expect(validatePhone('+44123')).toBe(false);
  });

  it('rejects an 11-digit number', () => {
    // Step 5: one digit too many. This is the case a non-anchored regex would wrongly accept,
    // so it specifically pins the trailing `$` in ^07[0-9]{8}$.
    expect(validatePhone('07177307730')).toBe(false);
  });

  it('rejects other near-miss shapes', () => {
    // Not in the row's steps, but these are the mutations that would slip past a weaker regex
    // and reach the backend's @Pattern as a 400.
    expect(validatePhone('0817730773')).toBe(false); // wrong prefix (08, not 07)
    expect(validatePhone('717730773')).toBe(false); // missing the leading 0
    expect(validatePhone('071773077a')).toBe(false); // non-numeric character
    expect(validatePhone(' 0717730773')).toBe(false); // leading whitespace
    expect(validatePhone('0717730773 ')).toBe(false); // trailing whitespace
  });
});
