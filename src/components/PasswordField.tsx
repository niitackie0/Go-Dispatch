/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  hint?: string;
  id?: string;
}

/**
 * A password box you can look at.
 *
 * Hiding what somebody types was designed for a shared terminal in an office,
 * and it has outlived that: on a phone, in a van, or at a desk nobody is
 * standing behind, the dots only mean typos go unnoticed until the form is
 * rejected. Worse here than most, because this product has no password reset
 * by email — somebody who mistypes a new password twice the same way locks
 * themselves out of a console that cannot let them back in.
 *
 * So the toggle is offered on every password box, and it starts hidden. The
 * eye button is a real button, in the tab order, labelled for a screen reader,
 * and it never submits the form it sits inside.
 */
export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  minLength,
  required,
  hint,
  id,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full min-h-12 rounded-2xl border border-slate-200/80 bg-white pl-3.5 pr-12 text-sm text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors"
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
        >
          {visible ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
        </button>
      </div>

      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
