import { startTransition, type FormEvent } from "react";

/**
 * onSubmit handler for forms driven by useActionState. Passing the action
 * through the form's `action` prop makes React clear every field after it
 * runs, so a validation error throws away what the person typed. Submitting
 * this way keeps their input.
 */
export function submitWithoutReset(formAction: (formData: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  };
}
