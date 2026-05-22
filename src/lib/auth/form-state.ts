export type FormFieldError = string;

export type FormState = {
  ok: boolean;
  error?: string;
  errorLink?: { href: string; label: string };
  fieldErrors?: Record<string, FormFieldError>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = { ok: false };
