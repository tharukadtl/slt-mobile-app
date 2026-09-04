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
 *   - ''    -> "no signature on record" message (no longer a block — see below)
 *
 * #12 (FR-9 client-declined-signature) — a missing signature no longer claims
 * to be blocking ("must capture a signature before payment can be submitted"
 * is gone): when needsTeamLeadReview is true, a review banner shows the real
 * decline reason instead, and explicitly states the Team Lead may still
 * submit. This is informational only — PaymentSubmissionScreen.handleSubmit
 * itself no longer gates on signature presence at all (covered separately in
 * PaymentSubmissionScreen.reviewFlag.test.tsx).
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
  needsTeamLeadReview: false,
  signatureDeclineReason: '',
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

const renderWith = (
  technicianSignature: string | null,
  overrides: Partial<typeof baseProps> = {},
) => {
  let tree: any;
  act(() => {
    tree = renderer.create(
      <Step4Signature
        {...baseProps}
        {...overrides}
        technicianSignature={technicianSignature}
      />,
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

  test("'' with no review flag -> shows a plain 'no signature on record' message, not a block", () => {
    const tree = renderWith('');
    expect(tree.root.findAllByType(Image).length).toBe(0);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(0);
    const text = allText(tree);
    expect(text).toContain('No customer signature on record for this job');
    // #12 — must no longer claim submission is blocked; that claim was removed
    // along with PaymentSubmissionScreen's hard block on signature presence.
    expect(text).not.toContain('must capture a signature');
    expect(text).not.toContain('before payment can be submitted');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // #12 (FR-9) — client unavailable/declined to sign: a review flag, not a block
  // ═══════════════════════════════════════════════════════════════════════

  test("'' with needsTeamLeadReview=true -> shows the real decline reason in a review banner, states submission is still allowed", () => {
    const tree = renderWith('', {
      needsTeamLeadReview: true,
      signatureDeclineReason: 'Client left the property before work finished',
    });
    expect(tree.root.findAllByType(Image).length).toBe(0);
    const text = allText(tree);
    expect(text).toContain('Flagged for Review');
    expect(text).toContain('Client left the property before work finished');
    expect(text).toContain('You may still submit this payment.');
    // The old unconditional block must be gone entirely on this path too.
    expect(text).not.toContain('must capture a signature');
  });

  test('needsTeamLeadReview=true with no reason text falls back to a generic explanation, not a blank banner', () => {
    const tree = renderWith('', {
      needsTeamLeadReview: true,
      signatureDeclineReason: '',
    });
    expect(allText(tree)).toContain(
      'The client was unavailable or declined to sign.',
    );
  });

  test('a real captured signature is shown even if needsTeamLeadReview is (inconsistently) true — signature takes priority', () => {
    const sig = 'data:image/png;base64,REALSIGDATA';
    const tree = renderWith(sig, {needsTeamLeadReview: true});
    expect(tree.root.findAllByType(Image).length).toBe(1);
    expect(allText(tree)).toContain('Signature captured at job completion');
    expect(allText(tree)).not.toContain('Flagged for Review');
  });

  test('Final Summary "Signed" row reads "Flagged" (not "No") when needsTeamLeadReview is true', () => {
    const tree = renderWith('', {
      needsTeamLeadReview: true,
      signatureDeclineReason: 'Client declined',
    });
    expect(allText(tree)).toContain('Flagged 🚩');
    expect(allText(tree)).not.toContain('No ❌');
  });
});
