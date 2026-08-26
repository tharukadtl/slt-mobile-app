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
 */
import React from 'react';
import {TouchableOpacity, Text, Alert} from 'react-native';
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

  beforeEach(() => {
    submitSignatureMock.mockClear();
    updateTaskStatusMock.mockClear();
    mockDispatch.mockClear();
    canvasProps.onOK = undefined;
    canvasProps.onEmpty = undefined;
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => alertSpy.mockRestore());

  const render = () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<SignatureScreen />);
    });
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
});
