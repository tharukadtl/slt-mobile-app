/**
 * Regression coverage for QA_Compliance_Consolidated_Report §2.5 (FR-9),
 * Layer 2 (Mobile Technician).
 *
 * Original bug: the Technician completion flow shipped a placeholder signature
 * ('signature_placeholder') and could complete a job without a real capture.
 *
 * These tests render the REAL SignatureScreen component with react-test-renderer
 * (the renderer already used by App.test.tsx — @testing-library/react-native is
 * still not installed in this project, so raw react-test-renderer is the
 * sanctioned approach) and drive its actual handleComplete handler:
 *
 *   (a) empty signature  -> Alert shown, submitSignature/dispatch NOT called
 *   (b) placeholder      -> Alert shown, submitSignature/dispatch NOT called
 *   (c) real signature   -> submitSignature called, then updateTaskStatus
 *                           dispatched with status: 'completed'
 *
 * i.e. the actual COMPLETED transition only fires AFTER a real signature is
 * accepted — proving the guard runs before any network/dispatch side effect.
 *
 * #12 (FR-9 client-declined-signature, added for this fix): SRS 5.3.1.3 —
 * "If the client is unavailable or declines to sign, the Technician records
 * a reason; the job can still be completed but is flagged for Team Lead
 * review." Covers the new "Client unavailable / declined to sign" path:
 *   (d) tapping it opens a reason modal
 *   (e) confirming with a blank reason is blocked (mandatory, per spec)
 *   (f) confirming with a real reason dispatches updateTaskStatus with
 *       status: 'completed' and signatureDeclineReason set, WITHOUT ever
 *       calling submitSignature — the decline path is routed entirely
 *       through the completion request, not the separate /signature call.
 */
import React from 'react';
import {TouchableOpacity, Text, TextInput, Alert} from 'react-native';
import renderer, {act} from 'react-test-renderer';

// ---- Mocks for heavy / native leaf dependencies -----------------------------

// Capture the SignatureCanvas props so the test can drive onOK/onEmpty.
const canvasProps: {onOK?: (s: string) => void; onEmpty?: () => void} = {};
jest.mock('react-native-signature-canvas', () => {
  const React2 = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      canvasProps.onOK = props.onOK;
      canvasProps.onEmpty = props.onEmpty;
      return React2.createElement('SignatureCanvas', null);
    },
  };
});

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
  useRoute: () => ({
    params: {
      taskId: '77',
      completionPhotoUrls: 'http://x/photo1.jpg',
      completionRemarks: 'done',
    },
  }),
}));
jest.mock('@react-navigation/stack', () => ({}));

const mockDispatch = jest.fn().mockResolvedValue({});
jest.mock('@store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

// Define the action-creator mock INSIDE the factory (jest is a global there):
// referencing an out-of-scope const would be captured eagerly during import
// hoisting, before it is initialized. We read it back via the import below.
jest.mock('@store/slices/technicianSlice', () => {
  const fn: any = jest.fn((args: any) => ({
    type: 'technician/updateTaskStatus',
    payload: args,
  }));
  fn.fulfilled = {match: () => true};
  return {updateTaskStatus: fn};
});

jest.mock('@services/technicianService', () => ({
  __esModule: true,
  default: {submitSignature: jest.fn().mockResolvedValue(undefined)},
}));

import SignatureScreen from '@screens/technician/SignatureScreen';
import {updateTaskStatus} from '@store/slices/technicianSlice';
import technicianService from '@services/technicianService';

const submitSignatureMock = technicianService.submitSignature as jest.Mock;
const updateTaskStatusMock = updateTaskStatus as unknown as jest.Mock;

// Flatten a Text node's children to a plain string for matching.
const textOf = (node: any): string => {
  const c = node.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

const pressButtonWithText = async (root: any, label: string) => {
  const buttons = root.root.findAllByType(TouchableOpacity);
  const target = buttons.find((b: any) =>
    b.findAllByType(Text).some((t: any) => textOf(t) === label),
  );
  if (!target) {
    throw new Error(`Button with text "${label}" not found`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};

describe('SignatureScreen — FR-9 completion guard', () => {
  let alertSpy: jest.SpyInstance;
  let currentTree: any;

  beforeEach(() => {
    submitSignatureMock.mockClear();
    updateTaskStatusMock.mockClear();
    mockDispatch.mockClear();
    canvasProps.onOK = undefined;
    canvasProps.onEmpty = undefined;
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    // Without this, TouchableOpacity's own internal Animated engine keeps
    // ticking on a real timer against a tree React still considers mounted,
    // and later crashes into torn-down module internals once Jest moves on.
    if (currentTree) act(() => currentTree.unmount());
    currentTree = undefined;
  });

  const render = () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<SignatureScreen />);
    });
    currentTree = tree;
    return tree;
  };

  test('empty signature is blocked before any network call or dispatch', async () => {
    const tree = render();
    // signature state is '' — press Complete Task
    await pressButtonWithText(tree, 'Complete Task');

    expect(alertSpy).toHaveBeenCalledWith(
      'Signature Required',
      expect.any(String),
    );
    expect(submitSignatureMock).not.toHaveBeenCalled();
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('placeholder signature is blocked before any network call or dispatch', async () => {
    const tree = render();
    // Simulate the canvas emitting the literal placeholder value.
    act(() => {
      canvasProps.onOK && canvasProps.onOK('signature_placeholder');
    });

    await pressButtonWithText(tree, 'Complete Task');

    expect(alertSpy).toHaveBeenCalledWith(
      'Signature Required',
      expect.any(String),
    );
    expect(submitSignatureMock).not.toHaveBeenCalled();
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('a real signature submits, THEN dispatches the completed transition', async () => {
    const tree = render();
    const realSig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA';
    act(() => {
      canvasProps.onOK && canvasProps.onOK(realSig);
    });

    await pressButtonWithText(tree, 'Complete Task');

    // Signature submitted with the captured value first...
    expect(submitSignatureMock).toHaveBeenCalledTimes(1);
    expect(submitSignatureMock).toHaveBeenCalledWith('77', realSig);
    // ...then the COMPLETED status transition is dispatched.
    expect(updateTaskStatusMock).toHaveBeenCalledTimes(1);
    const arg = updateTaskStatusMock.mock.calls[0][0];
    expect(arg).toMatchObject({
      id: '77',
      status: 'completed',
      completionPhotoUrls: 'http://x/photo1.jpg',
    });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    // The "Signature Required" block alert must NOT have fired on the happy path.
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Signature Required',
      expect.any(String),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // #12 (FR-9) — "Client unavailable / declined to sign"
  // ═══════════════════════════════════════════════════════════════════════

  test('tapping "Client unavailable / declined to sign" opens the reason modal', async () => {
    const tree = render();
    await pressButtonWithText(tree, 'Client unavailable / declined to sign');

    const texts = tree.root
      .findAllByType(Text)
      .map((t: any) => textOf(t));
    expect(texts).toContain('Client Unavailable / Declined to Sign');
  });

  test('confirming with a blank reason is blocked — mandatory per SRS 5.3.1.3', async () => {
    const tree = render();
    await pressButtonWithText(tree, 'Client unavailable / declined to sign');

    // No text typed — the confirm button is disabled, but also assert the
    // underlying handler itself refuses a blank reason (defense in depth,
    // matching this project's own established convention).
    const confirmButtons = tree.root
      .findAllByType(TouchableOpacity)
      .filter((b: any) =>
        b.findAllByType(Text).some((t: any) => textOf(t) === 'Complete Without Signature'),
      );
    expect(confirmButtons[0].props.disabled).toBe(true);

    await act(async () => {
      await confirmButtons[0].props.onPress();
    });

    expect(submitSignatureMock).not.toHaveBeenCalled();
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
  });

  test('a real decline reason dispatches COMPLETED with signatureDeclineReason, WITHOUT calling submitSignature', async () => {
    const tree = render();
    await pressButtonWithText(tree, 'Client unavailable / declined to sign');

    const input = tree.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('Client left the property before work finished');
    });

    await act(async () => {
      const confirmButtons = tree.root
        .findAllByType(TouchableOpacity)
        .filter((b: any) =>
          b.findAllByType(Text).some((t: any) => textOf(t) === 'Complete Without Signature'),
        );
      await confirmButtons[0].props.onPress();
    });

    // The separate /signature endpoint must never be called on this path.
    expect(submitSignatureMock).not.toHaveBeenCalled();

    expect(updateTaskStatusMock).toHaveBeenCalledTimes(1);
    const arg = updateTaskStatusMock.mock.calls[0][0];
    expect(arg).toMatchObject({
      id: '77',
      status: 'completed',
      completionPhotoUrls: 'http://x/photo1.jpg',
      signatureDeclineReason: 'Client left the property before work finished',
    });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});
