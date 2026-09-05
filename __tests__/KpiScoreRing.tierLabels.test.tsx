/**
 * KPI-007 (06_KPI_PERFORMANCE, FR-16) — was logged as "genuinely never-written, no substitute
 * exists anywhere" in the 2026-09-02 completeness recount; a real, previously-open product gap,
 * not a missing-test situation. Resolved 2026-09-05: `KpiScoreRing` now exists at
 * `@components/common/KpiScoreRing` and is wired into `technician/KPITargetsScreen.tsx`'s
 * `scoreCircle`, which previously just showed `{kpi.completionRate}%` with a static "Score" label.
 *
 * Tier bands are EXCELLENT/GOOD/AVERAGE/BELOW_AVERAGE/NEEDS_IMPROVEMENT — matching
 * `KpiCalculationService`'s real bands (fieldops), confirmed live against the backend — not the
 * 3-tier EXCELLENT/GOOD/NEEDS WORK system originally proposed by the test sheet, whose "55 ->
 * NEEDS WORK" example was itself wrong (55 is BELOW_AVERAGE).
 *
 * Still resolves the component dynamically (an import that fails at transform time would be a
 * test that never runs, not a test that fails) so this keeps working the same way if the module
 * path ever moves, mirroring the established pattern in `offlineQueue.test.ts`.
 */
import React from 'react';

const resolves = (moduleName: string): boolean => {
  try {
    require.resolve(moduleName);
    return true;
  } catch {
    return false;
  }
};

const CANDIDATE_MODULES = [
  '@components/common/KpiScoreRing',
  '@components/KpiScoreRing',
  '@components/kpi/KpiScoreRing',
];

describe('KPI-007 — KPI ring component renders tiered score labels', () => {
  test('scoreLabels_EXCELLENT_GOOD_NEEDS_WORK', () => {
    const foundModule = CANDIDATE_MODULES.find(resolves);

    const failures: string[] = [];
    const check = (ok: boolean, message: string) => {
      if (!ok) failures.push(message);
    };

    check(
      foundModule != null,
      'No KpiScoreRing component exists anywhere in the project (looked for: '
        + `${CANDIDATE_MODULES.join(', ')}). Confirmed by direct read of both real KPI score `
        + "displays (technician/KPITargetsScreen.tsx's scoreCircle, teamlead/KPIPerformanceScreen.tsx's "
        + 'completion-rate card): neither is a standalone, reusable component. PRODUCTION CHANGE '
        + 'REQUIRED. Logged as a new open finding, QA_Compliance_Consolidated_Report.md, 2026-09-02.',
    );

    if (foundModule) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(foundModule);
      const KpiScoreRing = mod?.default ?? mod;
      const renderer = require('react-test-renderer');

      const rendersLabel = (score: number, expectedLabel: string) => {
        let tree: any;
        try {
          tree = renderer.create(React.createElement(KpiScoreRing, {score}));
        } catch (e) {
          check(false, `KpiScoreRing threw rendering score=${score}: ${e}`);
          return;
        }
        const text = JSON.stringify(tree.toJSON());
        check(
          text.includes(String(score)),
          `KpiScoreRing with score=${score} must render the numeric value "${score}"`,
        );
        check(
          text.includes(expectedLabel),
          `KpiScoreRing with score=${score} must render the tier label "${expectedLabel}"`,
        );
      };

      rendersLabel(82, 'GOOD');
      rendersLabel(95, 'EXCELLENT');
      // 55 is BELOW_AVERAGE per KpiCalculationService's real bands (EXCELLENT
      // >=90, GOOD >=75, AVERAGE >=60, BELOW_AVERAGE >=40, NEEDS_IMPROVEMENT
      // below), confirmed live against the backend — not the bottom tier the
      // sheet originally proposed.
      rendersLabel(55, 'BELOW AVG');

      // score=0 must not crash.
      try {
        renderer.create(React.createElement(KpiScoreRing, {score: 0}));
      } catch (e) {
        check(false, `KpiScoreRing must not crash on score=0: ${e}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
