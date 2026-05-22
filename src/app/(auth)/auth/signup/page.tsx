import { SignupForm } from './signup-form';

// PROJ-2 forward-constraint: nodemailer is Node-only. The signup action
// invoked from this page calls sendMail() for the sysadmin notification,
// so the route must run on the Node runtime.
//
// NOTE on QA L2: PROJ-3 § M lists `actions.ts` as the canonical pin
// location, but Next.js forbids non-async exports from a `'use server'`
// file ("the module has no exports at all" — every export must be an
// async function). The pin must live on a route-segment file (page /
// layout / route), which is why it sits on page.tsx. The spec text in
// § M was aspirational; the structural Next.js constraint wins. The
// behaviour is identical because server actions inherit the runtime of
// their calling page.
export const runtime = 'nodejs';

export const metadata = {
  title: 'Request access · Calcgrinder',
};

export default function SignupPage() {
  return <SignupForm />;
}
