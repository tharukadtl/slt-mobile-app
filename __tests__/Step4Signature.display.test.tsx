/**
 * Regression coverage for QA_Compliance_Consolidated_Report §2.5 (FR-9),
 * Layer 3 (Mobile Team Lead) — Step4Signature.
 *
 * Original bug: the Team Lead's payment flow re-collected a brand-new customer
 * signature from a blank capture pad instead of showing the Technician's real
 * one. The fix removes the capture pad entirely; Step4Signature now only
 * DISPLAYS the technicianSignature prop:
 *   - null  -> loading spinner (ActivityIndicator)
 *   - value -> <Image> of the signature (uri = the signature)
 *   - ''    -> blocking "no customer signature found" message
 *
 * Rendered with react-test-renderer (RTL is not installed in this project).
 * This is a pure presentational component (no navigation/redux), so it renders
 * directly with props.
 */
import React from 'react';
import {Image, ActivityIndicator, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import Step4Signature from '@screens/teamlead/payment/Step4Signature';

const baseProps = {
  customerName: 'Jane',
  onCustomerNameChange: () => {},
  customerAgreed: false,
  onAgreedChange: () => {},
  materialsFOC: 0,
  materialsChargeable: 0,
  laborCharges: 0,
  totalFOC: 0,
  totalChargeable: 0,
  grandTotal: 0,
  justification: '',
};

const renderWith = (technicianSignature: string | null) => {
  let tree: any;
  act(() => {
    tree = renderer.create(
      <Step4Signature {...baseProps} technicianSignature={technicianSignature} />,
    );
  });
  return tree;
};

const allText = (tree: any): string =>
  tree.root
    .findAllByType(Text)
    .map((t: any) => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c);
    })
    .join(' | ');

describe('Step4Signature — displays Technician signature, never re-captures', () => {
  test('null -> shows a loading spinner, no Image, no warning', () => {
    const tree = renderWith(null);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);
    expect(tree.root.findAllByType(Image).length).toBe(0);
    expect(allText(tree)).not.toContain('No customer signature found');
  });

  test('real signature -> renders an Image with that uri (display only)', () => {
    const sig = 'data:image/png;base64,REALSIGDATA';
    const tree = renderWith(sig);
    const images = tree.root.findAllByType(Image);
    expect(images.length).toBe(1);
    expect(images[0].props.source).toEqual({uri: sig});
    // No spinner once loaded.
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(0);
    // Confirms it is captured, not offering to draw a new one.
    expect(allText(tree)).toContain('Signature captured at job completion');
  });

  test("'' -> shows blocking 'no signature found' message, no Image, no pad", () => {
    const tree = renderWith('');
    expect(tree.root.findAllByType(Image).length).toBe(0);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(0);
    expect(allText(tree)).toContain(
      'No customer signature found for this job',
    );
  });
});
