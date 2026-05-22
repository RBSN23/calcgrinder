import { SignupForm } from './signup-form';

// PROJ-2 forward-constraint: nodemailer is Node-only. The signup
// action invoked from this page calls sendMail() for the sysadmin
// notification, so the route must run on the Node runtime.
export const runtime = 'nodejs';

export const metadata = {
  title: 'Request access · Calcgrinder',
};

export default function SignupPage() {
  return <SignupForm />;
}
