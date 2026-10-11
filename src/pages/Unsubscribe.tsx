import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { invokeAdmin } from "@/lib/adminApi";

/**
 * Where the unsubscribe link in a marketing email lands. Public: the person is
 * not signed in. It asks for one click rather than acting on arrival, so a mail
 * scanner that opens the link cannot unsubscribe anyone by accident.
 * (Supabase does not serve HTML from functions, which is why this page lives here.)
 */
type State = "idle" | "working" | "done" | "invalid" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const [state, setState] = useState<State>(token ? "idle" : "invalid");

  const confirm = async () => {
    setState("working");
    try {
      const res = await invokeAdmin<{ ok: boolean }>("lifecycle-unsubscribe", { method: "POST", body: { token } });
      setState(res.ok ? "done" : "invalid");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <p className="mb-6 text-lg font-semibold text-emerald-600">Safe Spend</p>
        {state === "idle" || state === "working" ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-neutral-900">Unsubscribe from Safe Spend emails?</h1>
            <p className="mb-6 text-sm text-neutral-600">
              You will stop getting tips and reminders from us. Emails about your own account, such as a trial ending, may still be sent.
            </p>
            <button
              type="button" onClick={confirm} disabled={state === "working"}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
            >
              {state === "working" ? "Unsubscribing…" : "Yes, unsubscribe me"}
            </button>
          </>
        ) : state === "done" ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-neutral-900">You are unsubscribed</h1>
            <p className="text-sm text-neutral-600">We will not send you tips and reminders any more. You can change your email choices in the app's settings.</p>
          </>
        ) : state === "error" ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-neutral-900">Something went wrong</h1>
            <p className="mb-6 text-sm text-neutral-600">We could not process that. Please try again, or reply to the email and we will do it for you.</p>
            <button type="button" onClick={confirm} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">Try again</button>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold text-neutral-900">This link is not valid</h1>
            <p className="text-sm text-neutral-600">It may be incomplete or out of date. Reply to the email and we will unsubscribe you.</p>
          </>
        )}
      </div>
    </main>
  );
}
