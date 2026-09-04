/**
 * Regression coverage for QA_Compliance_Consolidated_Report §2.5 (FR-9),
 * Layer 3 (Mobile Team Lead) — PaymentSubmissionScreen.
 *
 * Original bug: the Team Lead re-captured a fresh signature and a payment could
 * be submitted carrying a placeholder/absent customer signature.
 *
 * The fix: PaymentSubmissionScreen fetches GET /api/jobs/{taskId} on mount,
 * reads response.data.completionSignature (the Technician's real signature),
 * and on success sends customerSignatureUrl = the fetched Technician
 * signature. The literal placeholder 'signature_placeholder' is still
 * rejected — it is never a legitimate value under any circumstance.
 *
 * #12 (FR-9 client-declined-signature, updated for this fix): a genuinely
 * MISSING signature no longer blocks submission at all — SRS 5.3.1.3 says the
 * job "can still be completed but is flagged for Team Lead review before
 * payment submission", not blocked outright. The old hard block asserting
 * "No valid customer signature found" is gone; PaymentSubmissionScreen now
 * also fetches needsTeamLeadReview/signatureDeclineReason and passes them to
 * Step4Signature (covered by Step4Signature.display.test.tsx), and
 * pre-populates customerName from the job record.
 *
 * Rendered with react-test-renderer (RTL is not installed). The Step1-4 child
 * components are mocked to auto-satisfy the per-step validations so the flow
 * can advance to the Submit button and exercise the real handleSubmit guard.
 */
import React from 'react';
import {TouchableOpacity, Text, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// --- api mock (default export with get/post) ---------------------------------
jest.mock('@services/api', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn()},
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
  useRoute: () => ({params: {taskId: '90'}}),
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
// Captures the most recent props Step4Signature was rendered with, so tests
// can assert what PaymentSubmissionScreen actually passes down (review
// flag/reason, pre-populated customer name) without needing RTL.
let lastStep4Props: any = null;
jest.mock('@screens/teamlead/payment/Step4Signature', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      lastStep4Props = props;
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

const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const pressButtonWithText = async (tree: any, label: string) => {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  const target = buttons.find((b: any) =>
    b.findAllByType(Text).some((t: any) => textOf(t) === label),
  );
  if (!target) {
    throw new Error(`Button "${label}" not found (current step buttons only)`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};

const advanceToStep4 = async (tree: any) => {
  await pressButtonWithText(tree, 'Next →'); // 1 -> 2
  await pressButtonWithText(tree, 'Next →'); // 2 -> 3
  await pressButtonWithText(tree, 'Next →'); // 3 -> 4
};

const advanceToStep4AndSubmit = async (tree: any) => {
  await advanceToStep4(tree);
  await pressButtonWithText(tree, 'Submit Payment'); // handleSubmit
};

describe('PaymentSubmissionScreen — FR-9 payment submission guard', () => {
  let alertSpy: jest.SpyInstance;
  let alerts: Array<{title: any; msg: any}>;

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    postMock.mockResolvedValue({data: {}});
    alerts = [];
    lastStep4Props = null;
    // Auto-confirm any confirmation dialog by invoking its "Submit" button.
    alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title: any, msg?: any, buttons?: any) => {
        alerts.push({title, msg});
        if (Array.isArray(buttons)) {
          const submit = buttons.find((b: any) => b.text === 'Submit');
          if (submit && submit.onPress) {
            submit.onPress();
          }
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

  test('fetches the job on mount to read the Technician signature', async () => {
    getMock.mockResolvedValue({data: {completionSignature: 'data:image/png;base64,REAL'}});
    await render();
    expect(getMock).toHaveBeenCalledWith('/api/jobs/90');
  });

  test('placeholder signature on the job -> submission still blocked, no POST', async () => {
    getMock.mockResolvedValue({
      data: {completionSignature: 'signature_placeholder'},
    });
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    expect(postMock).not.toHaveBeenCalled();
    expect(
      alerts.some(a => String(a.msg).includes('invalid placeholder')),
    ).toBe(true);
  });

  // #12 — the old hard block on a genuinely missing signature is gone.
  test('missing signature, no review flag -> submission proceeds (no longer blocked)', async () => {
    getMock.mockResolvedValue({data: {completionSignature: null}});
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(
      alerts.some(a => String(a.msg).includes('No valid customer signature')),
    ).toBe(false);
  });

  test('missing signature WITH needsTeamLeadReview -> submission still proceeds (flagged, not blocked)', async () => {
    getMock.mockResolvedValue({
      data: {
        completionSignature: null,
        needsTeamLeadReview: true,
        signatureDeclineReason: 'Client refused to sign',
      },
    });
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [, payload] = postMock.mock.calls[0];
    expect(payload).toMatchObject({jobId: 90});
  });

  test('real Technician signature -> POSTs it as customerSignatureUrl', async () => {
    const realSig = 'data:image/png;base64,REALSIGDATA';
    getMock.mockResolvedValue({data: {completionSignature: realSig}});
    const tree = await render();

    await advanceToStep4AndSubmit(tree);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, payload] = postMock.mock.calls[0];
    expect(url).toBe('/api/payments');
    expect(payload).toMatchObject({
      jobId: 90,
      customerSignatureUrl: realSig,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // #12 (FR-9) — review flag/reason and customer-name pre-population, fetched
  // from the same GET /api/jobs/{taskId} call and passed down to Step4Signature
  // ═══════════════════════════════════════════════════════════════════════

  test('needsTeamLeadReview + signatureDeclineReason from the job are passed to Step4Signature', async () => {
    getMock.mockResolvedValue({
      data: {
        completionSignature: null,
        needsTeamLeadReview: true,
        signatureDeclineReason: 'Client left the property before work finished',
        customerName: 'Nimal Perera',
      },
    });
    const tree = await render();
    await advanceToStep4(tree);

    expect(lastStep4Props.needsTeamLeadReview).toBe(true);
    expect(lastStep4Props.signatureDeclineReason).toBe(
      'Client left the property before work finished',
    );
  });

  test('needsTeamLeadReview defaults to false when the job carries none', async () => {
    getMock.mockResolvedValue({data: {completionSignature: 'sig'}});
    const tree = await render();
    await advanceToStep4(tree);

    expect(lastStep4Props.needsTeamLeadReview).toBe(false);
    expect(lastStep4Props.signatureDeclineReason).toBe('');
  });

  // SRS 5.3.1.3 — "client name... attached to the job record and forwarded
  // automatically" — pre-populated from the job, not retyped from scratch.
  test('customerName is pre-populated from the job record, not left blank', async () => {
    getMock.mockResolvedValue({
      data: {completionSignature: 'sig', customerName: 'Nimal Perera'},
    });
    const tree = await render();
    await advanceToStep4(tree);

    expect(lastStep4Props.customerName).toBe('Nimal Perera');
  });

  test('customerName stays blank (not "undefined" or similar) when the job has none', async () => {
    getMock.mockResolvedValue({data: {completionSignature: 'sig'}});
    const tree = await render();
    await advanceToStep4(tree);

    expect(lastStep4Props.customerName).toBe('');
  });
});
