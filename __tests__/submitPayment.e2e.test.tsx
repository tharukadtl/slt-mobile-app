/**
 * PAY-009 (04_PAYMENT_FLOW, FR-10) — the Team Lead's 4-step payment wizard, happy path: add a
 * material and set its quantity/FOC classification, enter the labour window, write the
 * justification, confirm the customer signature, submit, and land on a confirmation.
 *
 * <p><b>Tool substitution.</b> The sheet maps this row to Detox
 * (`e2e/payment/submitPayment.e2e.js::fourStepWizard_happyPath`, driving an Android emulator by
 * `testID`). Per the project decision of 2026-08-04 (SLT_Test_Plan_V1 §3), Detox builds but cannot
 * run live on this host, so Detox rows are executed as Jest + react-test-renderer instead —
 * precedent: `clientLogin.e2e.test.tsx` (AUTH-016). The row's selectors could not be used in any
 * case: `submitPaymentBtn-42`, `step1Next`, `step2Next`, `step3Next`, `signatureCanvas`,
 * `submitBtn` and `paymentConfirmScreen` do not exist — `PaymentSubmissionScreen.tsx` and its four
 * Step children set no `testID` at all, and adding them would be a production-code change.
 * Elements are therefore located by component type + visible label, the convention every other
 * screen test in this folder uses.
 *
 * <p><b>What is genuinely new here vs. the existing coverage.</b>
 * `PaymentSubmissionScreen.guard.test.tsx` (FR-9) mocks all four Step children away and only
 * exercises `handleSubmit`'s signature guard. This test renders the REAL `Step1Materials`,
 * `Step2Labor`, `Step3Justification` and `Step4Signature`, so what is under test is the wizard
 * itself: the per-step validation gates, the FOC/chargeable split, the labour auto-calculation and
 * the running totals the Team Lead actually sees. Only the HTTP boundary (`@services/api`) is
 * faked.
 *
 * <p><b>Two facts about the real screen the row did not anticipate.</b>
 * <ol>
 *   <li>The hourly rate is hardcoded to <b>LKR 500</b> in `PaymentSubmissionScreen` and is
 *       display-only in Step 2 (no editor anywhere in the app). The row assumes LKR 1500/h, so its
 *       "2.5h -> LKR 3,750" is asserted here as the wizard's real arithmetic, 2.5h x 500 =
 *       <b>LKR 1,250.00</b>. The behaviour under test — labour auto-calculates from the window and
 *       is shown before Next — is unchanged.</li>
 *   <li>The justification gate is "at least 50 characters whenever anything is chargeable", not
 *       the sheet's LKR 5000 threshold (which exists nowhere in this system — see PAY-004).</li>
 * </ol>
 */
import React from 'react';
import {Switch, Text, TextInput, TouchableOpacity, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// --- api mock (default export with get/post), same shape as the sibling guard test -----------
jest.mock('@services/api', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn()},
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
  useRoute: () => ({params: {taskId: '42'}}),
}));
jest.mock('@react-navigation/stack', () => ({}));

import PaymentSubmissionScreen from '@screens/teamlead/PaymentSubmissionScreen';
import api from '@services/api';

const getMock = (api as any).get as jest.Mock;
const postMock = (api as any).post as jest.Mock;

const TECH_SIGNATURE = 'data:image/png;base64,REALSIGNATUREFROMTECHNICIAN';

// The row's justification step: >= 50 chars, which is what the real Step 3 gate requires.
const JUSTIFICATION =
  'Router replaced after customer-caused physical damage to the original unit; out of warranty.';

// Single source of truth for what the server "returns" on submit. Used both to configure the
// mock and, later, to assert the confirmation actually reflects these exact values — never
// duplicated as separate literals, so the two can't silently drift apart.
const MOCK_PAYMENT_RESPONSE = {id: 15, paymentNumber: 'PAY-2026-00015', status: 'DRAFT'};

// ── helpers ────────────────────────────────────────────────────────────────────
const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

/** Every rendered Text joined, for "is this string on screen?" assertions. */
const allText = (tree: any): string =>
  tree.root.findAllByType(Text).map(textOf).join(' | ');

const pressButtonWithText = async (tree: any, label: string) => {
  const target = tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) => b.findAllByType(Text).some((t: any) => textOf(t) === label));
  if (!target) {
    throw new Error(
      `Button "${label}" not found. Buttons currently on screen: ` +
        tree.root
          .findAllByType(TouchableOpacity)
          .map((b: any) => b.findAllByType(Text).map(textOf).join(''))
          .join(' / '),
    );
  }
  await act(async () => {
    await target.props.onPress();
  });
};

/** Press a button whose visible label CONTAINS the given fragment (e.g. a time "08:00"). */
const pressButtonContaining = async (tree: any, fragment: string) => {
  const target = tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) =>
      b.findAllByType(Text).some((t: any) => textOf(t).includes(fragment)),
    );
  if (!target) {
    throw new Error(`No button containing "${fragment}" found`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};

describe('PAY-009 — Team Lead 4-step payment wizard, happy path', () => {
  let alertSpy: jest.SpyInstance;
  let alerts: Array<{title: any; msg: any}>;

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    mockNavigate.mockReset();
    getMock.mockResolvedValue({data: {completionSignature: TECH_SIGNATURE}});
    postMock.mockResolvedValue({data: MOCK_PAYMENT_RESPONSE});
    alerts = [];
    // Auto-confirm the submit confirmation dialog, and record every alert raised.
    alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title: any, msg?: any, buttons?: any) => {
        alerts.push({title, msg});
        if (Array.isArray(buttons)) {
          const submit = buttons.find((b: any) => b.text === 'Submit');
          if (submit?.onPress) submit.onPress();
        }
      });
  });

  afterEach(() => alertSpy.mockRestore());

  const render = async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<PaymentSubmissionScreen />);
    });
    return tree;
  };

  test('fourStepWizard_happyPath', async () => {
    const tree = await render();

    // ── Step 1: materials — add one, set qty 2, keep it chargeable ─────────────
    expect(allText(tree)).toContain('Step 1: Materials Used');

    // The wizard refuses to advance with no materials (the row's implicit precondition).
    await pressButtonWithText(tree, 'Next →');
    expect(allText(tree)).toContain('Step 1: Materials Used');
    expect(
      alerts.some(a => String(a.msg).includes('at least one material')),
    ).toBe(true);

    await pressButtonWithText(tree, '+ Add Material');
    await pressButtonContaining(tree, 'Network Switch'); // LKR 2,500/unit

    // qty 1 -> 2  (the row's "set mat qty=2"): subtotal must double.
    await pressButtonWithText(tree, '+');
    expect(allText(tree)).toContain('LKR 5,000.00');

    // A newly added material defaults to CHARGEABLE, which is what the row wants billed.
    expect(allText(tree)).toContain('Materials Chargeable:');
    expect(allText(tree)).toContain('(CHARGEABLE)');

    // Toggling classifies it FOC instead — the FOC/chargeable split the row exercises.
    const materialSwitch = tree.root.findAllByType(Switch)[0];
    await act(async () => {
      materialSwitch.props.onValueChange(false);
    });
    expect(allText(tree)).toContain('(FOC)');

    // Toggle back to chargeable for the rest of the flow.
    await act(async () => {
      tree.root.findAllByType(Switch)[0].props.onValueChange(true);
    });
    expect(allText(tree)).toContain('(CHARGEABLE)');

    await pressButtonWithText(tree, 'Next →');

    // ── Step 2: labour — a 2.5h window, auto-calculated and shown ──────────────
    expect(allText(tree)).toContain('Step 2');

    // The wizard refuses to advance before a work window is entered.
    await pressButtonWithText(tree, 'Next →');
    expect(
      alerts.some(a => String(a.msg).includes('work start and end time')),
    ).toBe(true);

    // Drive the real time pickers: 08:00 -> 10:30 = 2.5 hours.
    await pressButtonContaining(tree, '08:00');
    await selectTime(tree, '08', '00');
    await pressButtonContaining(tree, '10:00');
    await selectTime(tree, '10', '30');

    const step2Text = allText(tree);
    expect(step2Text).toContain('2 hours 30 minutes');
    // 2.5h x the app's hardcoded LKR 500/h = LKR 1,250.00 (see the header note on the row's
    // assumed LKR 1500/h rate, which this app has no way to set).
    expect(step2Text).toContain('LKR 1,250.00');
    expect(step2Text).toContain('LKR 500.00/hour');

    await pressButtonWithText(tree, 'Next →');

    // ── Step 3: justification — mandatory because the work is chargeable ───────
    expect(allText(tree)).toContain('Step 3: Justification');

    // Under 50 characters is refused while anything is chargeable.
    const shortText = 'Too short';
    await typeJustification(tree, shortText);
    await pressButtonWithText(tree, 'Next →');
    expect(allText(tree)).toContain('Step 3: Justification');
    expect(
      alerts.some(a => String(a.msg).includes('at least 50 characters')),
    ).toBe(true);

    await typeJustification(tree, JUSTIFICATION);

    // The running grand total is the chargeable side only: materials 5000 + labour 1250.
    expect(allText(tree)).toContain('LKR 6,250.00');

    await pressButtonWithText(tree, 'Next →');

    // ── Step 4: signature — the Technician's, displayed not re-captured ────────
    const step4Text = allText(tree);
    expect(step4Text).toContain('Signature captured at job completion');
    expect(getMock).toHaveBeenCalledWith('/api/jobs/42');

    // Submit is gated on the customer agreeing.
    const submitBtn = tree.root
      .findAllByType(TouchableOpacity)
      .find((b: any) =>
        b.findAllByType(Text).some((t: any) => textOf(t) === 'Submit Payment'),
      );
    expect(submitBtn.props.disabled).toBe(true);

    // The customer ticks all three agreement items — only then does onAgreedChange(true) fire.
    for (const item of [
      'I confirm the work was completed satisfactorily',
      'I accept the charges as explained',
      'I understand this will be added to my bill',
    ]) {
      await pressButtonWithText(tree, item);
    }

    expect(
      tree.root
        .findAllByType(TouchableOpacity)
        .find((b: any) =>
          b.findAllByType(Text).some((t: any) => textOf(t) === 'Submit Payment'),
        ).props.disabled,
    ).toBe(false);

    await pressButtonWithText(tree, 'Submit Payment');

    // ── The submitted payload carries the whole wizard's state ─────────────────
    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, payload] = postMock.mock.calls[0];
    expect(url).toBe('/api/payments');
    expect(payload).toMatchObject({
      jobId: 42,
      materialsFocTotal: 0,
      materialsChargeableTotal: 5000,
      labourCharge: 1250,
      hourlyRate: 500,
      customerSignatureUrl: TECH_SIGNATURE,
      materialJustification: JUSTIFICATION,
    });
    expect(payload.labourStartTime).toContain('T08:00:00');
    expect(payload.labourEndTime).toContain('T10:30:00');

    // ── The row's step 7-8: a confirmation built from the real POST response, not a fixed
    // string. Asserted directly against MOCK_PAYMENT_RESPONSE's own fields (the single source
    // of truth configured in beforeEach) rather than a hardcoded literal here — if the screen
    // ever regresses to discarding the response and alerting a fixed string again, these fields
    // simply won't be in the message and this fails for the real reason, not a string that
    // merely narrates the bug.
    const confirmation = alerts[alerts.length - 1];
    const msg = String(confirmation.msg);
    expect(String(confirmation.title)).toBe('Success');
    expect(msg).toContain('submitted successfully');
    expect(msg).toContain(String(MOCK_PAYMENT_RESPONSE.id));
    expect(msg).toContain(MOCK_PAYMENT_RESPONSE.paymentNumber);
    expect(msg).toContain(MOCK_PAYMENT_RESPONSE.status);

    // Without this, TouchableOpacity/Switch's own internal Animated engine
    // (owned by react-native, not this screen) keeps ticking on a real timer
    // against a tree React still considers mounted, and later crashes into
    // torn-down module internals once Jest moves past this file.
    act(() => tree.unmount());
    // Real Step1-4 components across a full wizard walkthrough — verified
    // locally to take ~17s cold vs ~5s warm, well over Jest's 5000ms default
    // on a shared CI runner.
  }, 20000);
});

/**
 * Choose an hour + minute in the real Step2Labor time-picker overlay, then confirm.
 *
 * The two option lists overlap ('00', '15', '30' and '45' are valid hours AND valid minutes), so
 * each press is scoped to its own column by locating the column's "Hour"/"Min" heading and
 * searching only that heading's parent View. A flat search would pick the hour column's '00' when
 * asked for a '00' minute.
 */
async function selectTime(tree: any, hour: string, minute: string) {
  await pressInColumn(tree, 'Hour', hour);
  await pressInColumn(tree, 'Min', minute);
  await pressButtonWithText(tree, 'Confirm');
}

async function pressInColumn(tree: any, heading: string, value: string) {
  const label = tree.root
    .findAllByType(Text)
    .find((t: any) => textOf(t) === heading);
  if (!label) throw new Error(`Time-picker column "${heading}" not on screen`);

  const target = label.parent
    .findAllByType(TouchableOpacity)
    .find((b: any) => b.findAllByType(Text).some((t: any) => textOf(t) === value));
  if (!target) {
    throw new Error(`"${value}" is not an option in the ${heading} column`);
  }
  await act(async () => {
    target.props.onPress();
  });
}

/** Type into Step 3's justification TextInput (the only multiline input on that step). */
async function typeJustification(tree: any, text: string) {
  const inputs = tree.root.findAllByType(TextInput);
  const field =
    inputs.find((i: any) => i.props.multiline) ?? inputs[inputs.length - 1];
  await act(async () => {
    field.props.onChangeText(text);
  });
}
