"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "./input";
import { dateInputError, formatDate, parseDateInput } from "@/lib/ui/date-display";

type DateInputProps = Omit<ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"> & {
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  onValueChange?: (isoDate: string) => void;
};

export function DateInput({
  name, value, defaultValue = "", min, max, onValueChange, disabled,
  ...props
}: DateInputProps) {
  const initial = value ?? defaultValue;
  const [text, setText] = useState(() => initial ? formatDate(initial) : "");
  const input = useRef<HTMLInputElement>(null);
  const iso = parseDateInput(text) ?? "";

  useEffect(() => {
    if (value !== undefined) setText(value ? formatDate(value) : "");
  }, [value]);

  useEffect(() => {
    input.current?.setCustomValidity(dateInputError(text, min, max));
  }, [text, min, max]);

  useEffect(() => {
    const form = input.current?.form;
    const reset = () => {
      setText(initial ? formatDate(initial) : "");
      onValueChange?.(initial);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial, onValueChange]);

  return (
    <>
      <Input {...props} ref={input} type="text" disabled={disabled}
        placeholder="19-Oct-2026" autoComplete="off" spellCheck={false}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          event.target.setCustomValidity(dateInputError(next, min, max));
          const parsed = parseDateInput(next);
          if (parsed || !next.trim()) onValueChange?.(parsed ?? "");
        }}
        onBlur={(event) => {
          if (iso) setText(formatDate(iso));
          props.onBlur?.(event);
        }}
      />
      <input type="hidden" name={name} value={iso} disabled={disabled} />
    </>
  );
}
