// Live-backend integration test: proves the real Team-Lead-dispatches-a-job mechanism works
// end-to-end against a genuine, running fieldops instance -- nothing under @services/* is mocked,
// authentication is a direct thunk dispatch (see liveTestHelpers.ts's loginViaOtp), and the BOD
// and job-assignment steps themselves are real, awaited API calls rather than driven through
// AssignJobsScreen's UI. AssignJobsScreen has no Redux thunk for job creation at all -- it calls
// api.post('/api/jobs', ...) directly from the component -- so a real, directly-awaited api.post
// call (identical to what the screen itself does internally) is the closest equivalent to this
// suite's "dispatch the thunk directly, not through the UI" convention.
//
// Fixtures: scripts/live/seed_admin.py's seed-job-assignment command seeds an OPMC, a Work Group,
// a Team Lead (phone 0770000001) and a Technician (phone 0770000002, a member of the same Work
// Group), and one unclaimed Fault already routed to that Work Group (fault_number
// CIJA-TEST-001) -- see that script for exactly why each of those needs seeding versus being
// discoverable live. This test discovers the seeded fault by that deterministic fault_number via
// a real GET /api/faults/my-workgroup call rather than needing its id passed through CI; the
// technician's real, auto-generated user id has no equivalent discovery path before BOD (GET
// /api/team/members only returns *today's* session members, which don't exist until BOD happens),
// so it's the one value this workflow actually passes through as SEEDED_TECHNICIAN_ID.
//
// Excluded from the normal `npm test` run via jest.config.js's testPathIgnorePatterns -- only
// .github/workflows/live-backend.yml runs this, with API_BASE_URL=http://localhost:8080,
// FIELDOPS_LOG_PATH pointing at fieldops's own log, and SEEDED_TECHNICIAN_ID from the seed step.
import {store} from '@store/index';
import api from '@services/api';
import {loginViaOtp} from './liveTestHelpers';

const TEAM_LEAD_PHONE = '0770000001';
const FAULT_NUMBER = 'CIJA-TEST-001';

// Real Colombo coordinates -- must fall inside LocationService.validateSriLankaCoords' bounds.
const COLOMBO_LAT = 6.9271;
const COLOMBO_LNG = 79.8612;

interface QueuedFault {
  id: number;
  faultNumber: string;
}

interface CreatedJob {
  status: string;
  faultId: number;
  technicianId: number;
  teamLeadId: number;
}

describe('Live backend: job assignment', () => {
  it('performs a real BOD, discovers the seeded fault, and dispatches a real job to the seeded technician', async () => {
    const technicianId = process.env.SEEDED_TECHNICIAN_ID;
    if (!technicianId) {
      throw new Error(
        'SEEDED_TECHNICIAN_ID is not set -- this test only runs after ' +
          "scripts/live/seed_admin.py's seed-job-assignment command (see .github/workflows/live-backend.yml).",
      );
    }

    await loginViaOtp(store.dispatch, TEAM_LEAD_PHONE);
    expect(store.getState().auth.token).toBeTruthy();
    expect(store.getState().auth.user?.role).toBe('teamlead');

    // Real POST /api/jobs/bod -- creates today's DaySession with the seeded technician as an
    // active member, a genuine precondition JobService.createJob enforces server-side
    // ("You must complete BOD before creating jobs.") -- not something worth mocking around.
    const bodResponse = await api.post('/api/jobs/bod', {
      latitude: COLOMBO_LAT,
      longitude: COLOMBO_LNG,
      locationAddress: 'CI live-backend test -- Colombo',
      technicianIds: [Number(technicianId)],
    });
    expect(bodResponse.status).toBe(201);

    // Real GET /api/faults/my-workgroup -- discovers the seeded, unclaimed fault by its
    // deterministic fault_number.
    const queueResponse = await api.get<QueuedFault[]>('/api/faults/my-workgroup');
    const seededFault = queueResponse.data.find(f => f.faultNumber === FAULT_NUMBER);
    if (!seededFault) {
      throw new Error(
        `Seeded fault ${FAULT_NUMBER} not found in this Team Lead's Work Group queue. ` +
          `Queue: ${JSON.stringify(queueResponse.data)}`,
      );
    }

    // Step under test: a real POST /api/jobs -- the exact call AssignJobsScreen.handleAssign
    // makes, dispatched here directly and awaited rather than through that screen's UI.
    const jobResponse = await api.post<CreatedJob>('/api/jobs', {
      faultId: seededFault.id,
      technicianId: Number(technicianId),
      priority: 'MEDIUM',
    });

    expect(jobResponse.status).toBe(201);
    expect(jobResponse.data.status).toBe('PENDING');
    expect(jobResponse.data.faultId).toBe(seededFault.id);
    expect(jobResponse.data.technicianId).toBe(Number(technicianId));
    expect(jobResponse.data.teamLeadId).toBeTruthy();
  }, 30000);
});
