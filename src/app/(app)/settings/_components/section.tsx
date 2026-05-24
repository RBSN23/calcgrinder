import * as React from 'react';

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-cg-text">{title}</h2>
        {description ? (
          <p className="text-sm text-cg-text-muted">{description}</p>
        ) : null}
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  htmlFor,
  helper,
  caption,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  helper?: React.ReactNode;
  caption?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            className="text-sm font-medium text-cg-text"
          >
            {label}
          </label>
        ) : (
          <span className="text-sm font-medium text-cg-text">{label}</span>
        )}
        {caption ? (
          <span className="text-xs leading-5 text-cg-text-muted">{caption}</span>
        ) : null}
      </div>
      {children}
      {helper ? (
        <p className="text-xs leading-5 text-cg-text-muted">{helper}</p>
      ) : null}
    </div>
  );
}

export function SettingsDivider() {
  return <div className="h-px w-full bg-cg-border" role="presentation" />;
}
