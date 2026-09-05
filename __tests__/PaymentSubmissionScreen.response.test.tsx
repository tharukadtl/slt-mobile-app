/**
 * Regression coverage for the PAY-009 follow-up fix to
 * `PaymentSubmissionScreen.handleSubmit`'s Submit handler.
 *
 * Original bug: the handler fired `await api.post('/api/payments', {...})` WITHOUT
 * assigning the result and then unconditionally alerted a fixed success string
 * ("Payment submitted successfully for admin review") and navigated to
 * TeamLeadTabs. A 2xx with no payment body — or any response the server did not
 * actually persist — was therefore reported to the Team Lead as a success, and the
 * real paymentNumber/id/status the server minted were discarded.
 *
 * The fix: capture the response, treat the submission as successful ONLY when
 * `response.data.id` is present, build the confirmation from the real
 * paymentNumber/id/status (falling back to 'PENDING' when status is omitted), and
 * on a missing id show a failure alert and stay on the screen.
 *
 * What this file adds over the two existing suites:
 *   - submitPayment.e2e.test.tsx  covers only the HAPPY path (id + paymentNumber +
 *     status all present) and never asserts navigation.
 *   - PaymentSubmissionScreen.guard.test.tsx  stubs `post` as `{data: {}}`, so it
 *     EXECUTES the new failure branch but asserts nothing about it — it would stay
 *     green if the branch alerted "Success" instead.
 * The failure branch, the 'PENDING' status fallback, the no-paymentNumber
 * reference, and "no navigation on failure" are therefore all unasserted today.
 *
 * Rendered with react-test-renderer (RTL is not installed) and the Step1-4 children
 * mocked to auto-satisfy each step's validation — the exact convention
 * PaymentSubmissionScreen.guard.test.tsx established, so the flow can reach Submit
 * and exercise the REAL handleSubmit.
 */
import React from 'react';
import {TouchableOpacity, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// --- api mock (default export with get/post) ---------------------------------
jest.mock('@services/api', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn()},
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
  useRoute: () => ({params: {taskId: '77'}}),
}));
jest.mock('@react-navigation/stack', () => ({}));

// --- Step children: auto-fire the callbacks needed to pass each step's guard.
// Kept charge-free (FOC) so Step3's justification-length check is skipped.
jest.mock('@screens/teamlead/payment/Step1Materials', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      R.useEffect(() => {
        props.onMaterialsChange([
          {id: '1', name: 'Cable', type: 'FOC', quantity: 1, subtotal: 0},
        ]);
      }, []);
      return null;
    },
  };
});
jest.mock('@screens/teamlead/payment/Step2Labor', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      R.useEffect(() => {
        props.onLaborChange({
          startTime: '09:00',
          endTime: '10:00',
          totalHours: 1,
          hourlyRate: 500,
          laborCharges: 0,
          type: 'FOC',
        });
      }, []);
      return null;
    },
  };
});
jest.mock('@screens/teamlead/payment/Step3Justification', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@screens/teamlead/payment/Step4Signature', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      R.useEffect(() => {
        props.onAgreedChange(true);
      }, []);
      return null;
    },
  };
});

import PaymentSubmissionScreen from '@screens/teamlead/PaymentSubmissionScreen';
import api from '@services/api';

const getMock = (api as any).get as jest.Mock;
const postMock = (api as any).post as jest.Mock;

const REAL_SIGNATURE = 'data:image/png;base64,REALSIGDATA';

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const pressButtonWithText = async (tree: any, label: string) => {
  const target = tree.root
    .findAllByType(TouchableOpacity)
    .find((b: any) => b.findAllByType(Text).some((t: any) => textOf(t) === label));
  if (!target) {
    throw new Error(`Button "${label}" not found (current step buttons only)`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};

const advanceToStep4AndSubmit = async (tree: any) => {
  await pressButtonWithText(tree, 'Next →'); // 1 -> 2
  await pressButtonWithText(tree, 'Next →'); // 2 -> 3
  await pressButtonWithText(tree, 'Next →'); // 3 -> 4
  await pressButtonWithText(tree, 'Submit Payment'); // handleSubmit
};

type RecordedAlert = {title: string; msg: string; buttons?: any};

describe('PaymentSubmissionScreen — POST /api/payments response handling', () => {
  let alertSpy: jest.SpyInstance;
  let alerts: RecordedAlert[];
  let currentTree: any;

  /** The alert raised after the "Submit" confirmation was accepted. */
  const outcome = () => alerts[alerts.length - 1];

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    mockNavigate.mockReset();
    getMock.mockResolvedValue({data: {completionSignature: REAL_SIGNATURE}});
    alerts = [];
    // Auto-confirm the "Submit Payment" confirmation dialog, and record every alert
    // (title, message AND buttons) so the outcome alert can be inspected.
    alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title: any, msg?: any, buttons?: any) => {
        alerts.push({title: String(title), msg: String(msg), buttons});
        if (Array.isArray(buttons)) {
          const submit = buttons.find((b: any) => b.text === 'Submit');
          if (submit?.onPress) submit.onPress();
        }
      });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    // Without this, TouchableOpacity's own internal Animated engine keeps
    // ticking on a real timer against a tree React still considers mounted,
    // and later crashes into torn-down module internals once Jest moves on.
    if (currentTree) act(() => currentTree.unmount());
    currentTree = undefined;
  });

  const render = async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<PaymentSubmissionScreen />);
    });
    currentTree = tree;
    return tree;
  };

  // ── The bug itself: a 2xx that carries no saved payment ──────────────────────
  test('response with no data.id -> failure alert, no success, no navigation', async () => {
    postMock.mockResolvedValue({data: {}});
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    expect(postMock).toHaveBeenCalledTimes(1);

    const last = outcome();
    expect(last.title).toBe('Submission Failed');
    expect(last.msg).toContain('did not confirm the payment');

    // The pre-fix code alerted a fixed success string here regardless of the body.
    expect(alerts.some(a => a.title === 'Success')).toBe(false);
    expect(alerts.some(a => /submitted successfully/i.test(a.msg))).toBe(false);

    // ...and it navigated away, stranding the Team Lead with no way back to retry.
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(last.buttons).toBeUndefined();
  });

  test('response with no body at all -> failure alert, no navigation', async () => {
    postMock.mockResolvedValue(undefined);
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(outcome().title).toBe('Submission Failed');
    expect(alerts.some(a => a.title === 'Success')).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('data.id present but null/0 is not treated as a saved payment', async () => {
    postMock.mockResolvedValue({data: {id: null, status: 'DRAFT'}});
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    expect(outcome().title).toBe('Submission Failed');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('server error -> failure alert carrying the server message, no navigation', async () => {
    postMock.mockRejectedValue({
      response: {data: {message: 'Job already has a payment'}},
    });
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    const last = outcome();
    expect(last.title).toBe('Submission Failed');
    expect(last.msg).toBe('Job already has a payment');
    expect(alerts.some(a => a.title === 'Success')).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── The success path: the confirmation is built from the RESPONSE ────────────
  test('saved payment -> confirmation quotes the response paymentNumber/id/status', async () => {
    postMock.mockResolvedValue({
      data: {id: 15, paymentNumber: 'PAY-2026-00015', status: 'DRAFT'},
    });
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    const last = outcome();
    expect(last.title).toBe('Success');
    expect(last.msg).toContain('PAY-2026-00015 (#15)');
    expect(last.msg).toContain('Status: DRAFT');
  });

  test('a DIFFERENT saved payment -> confirmation follows the response, not a constant', async () => {
    postMock.mockResolvedValue({
      data: {id: 902, paymentNumber: 'PAY-2026-00902', status: 'PENDING_CLIENT_REVIEW'},
    });
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    const last = outcome();
    expect(last.msg).toContain('PAY-2026-00902 (#902)');
    expect(last.msg).toContain('Status: PENDING_CLIENT_REVIEW');
    // Proves the string is not hardcoded to the other suite's fixture.
    expect(last.msg).not.toContain('PAY-2026-00015');
  });

  test('status omitted -> falls back to PENDING; paymentNumber omitted -> bare #id', async () => {
    postMock.mockResolvedValue({data: {id: 77}});
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    const last = outcome();
    expect(last.title).toBe('Success');
    expect(last.msg).toContain('Payment #77 submitted successfully');
    expect(last.msg).toContain('Status: PENDING');
  });

  test('saved payment -> the confirmation OK button navigates to TeamLeadTabs', async () => {
    postMock.mockResolvedValue({
      data: {id: 15, paymentNumber: 'PAY-2026-00015', status: 'DRAFT'},
    });
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    const last = outcome();
    expect(last.title).toBe('Success');
    // Navigation is deferred to the OK press, not fired eagerly.
    expect(mockNavigate).not.toHaveBeenCalled();

    const ok = (last.buttons as any[]).find(b => b.text === 'OK');
    expect(ok).toBeDefined();
    await act(async () => {
      ok.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('TeamLeadTabs');
  });
});
