import { SysadminPill } from '@/components/shell/sysadmin-pill';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDefaultThemeId, getThemeIds } from '@/lib/themes';
import { getTheme } from '@/lib/themes';

import { AppThemeRow } from './_components/app-theme-row';
import { DangerZone } from './_components/danger-zone';
import { DefaultCalcThemeRow } from './_components/default-calc-theme-row';
import { EmailRow } from './_components/email-row';
import { NameRow } from './_components/name-row';
import { PasswordForm } from './_components/password-form';
import {
  SettingsDivider,
  SettingsRow,
  SettingsSection,
} from './_components/section';

export const metadata = {
  title: 'Settings · Calcgrinder',
};

const RETENTION_DAYS = Number(process.env.RETENTION_PERIOD_DAYS) || 30;

/**
 * Look up the in-flight email-change target from Supabase Auth admin.
 *
 * The SDK returns it on `user.new_email`. We deliberately use the admin
 * client (not the session-bound client) because `getUserById` is the
 * canonical read path for the admin-managed email-change state and it
 * doesn't depend on cookies.
 */
async function readPendingEmail(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const newEmail = (data.user as { new_email?: string | null }).new_email;
    return newEmail && newEmail.length > 0 ? newEmail : null;
  } catch {
    return null;
  }
}

async function readPendingDeletion(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('account_deletion_requests')
      .select('consumed_at, cancelled_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return false;
    return data.consumed_at == null && data.cancelled_at == null;
  } catch {
    return false;
  }
}

export default async function SettingsPage() {
  const current = await getCurrentProfile();
  if (!current) {
    // The (app) layout already redirects; this is a defensive read.
    return null;
  }

  const [pendingEmail, hasPendingDeletion] = await Promise.all([
    readPendingEmail(current.user.id),
    readPendingDeletion(current.user.id),
  ]);

  const themeOptions = getThemeIds().map((id) => {
    const theme = getTheme(id);
    return { id, displayName: theme.displayName };
  });
  const currentThemeId =
    current.profile.default_calculator_theme ?? getDefaultThemeId();

  const isSysadmin = current.profile.role === 'sysadmin';
  const dangerVariant: 'default' | 'pending' | 'sysadmin' = isSysadmin
    ? 'sysadmin'
    : hasPendingDeletion
      ? 'pending'
      : 'default';

  return (
    <div className="flex w-full flex-col px-5 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8">
        <h1 className="text-2xl font-semibold tracking-tight text-cg-text">
          Settings
        </h1>

        <SettingsSection title="Profile">
          <NameRow initialName={current.profile.name} />
          <EmailRow
            currentEmail={current.user.email}
            pendingEmail={pendingEmail}
          />
          <SettingsRow
            label={
              <span className="flex items-center gap-2">
                Role
                {isSysadmin ? <SysadminPill /> : null}
              </span>
            }
            helper={
              isSysadmin
                ? "Sysadmin can approve new users and curate Presets. The role is set by another sysadmin and can't be changed here."
                : 'Your role is set by a sysadmin.'
            }
          >
            <span className="text-sm text-cg-text">
              {isSysadmin ? 'Sysadmin' : 'Registered user'}
            </span>
          </SettingsRow>
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection title="Security">
          <PasswordForm />
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection title="Preferences">
          <AppThemeRow />
          <DefaultCalcThemeRow
            options={themeOptions}
            currentValue={currentThemeId}
          />
        </SettingsSection>

        <SettingsDivider />

        <DangerZone
          variant={dangerVariant}
          currentEmail={current.user.email}
          retentionDays={RETENTION_DAYS}
        />
      </div>
    </div>
  );
}
