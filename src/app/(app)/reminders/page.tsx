"use client";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PhoneOutgoing } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/utils";
import { RequireHospital } from "@/components/require-hospital";
import { PageHeader, Card, CardHeader, CardBody, Badge, Spinner, EmptyState } from "@/components/ui";
import { useToast, useReadOnly } from "@/components/providers";
import type { ReminderSettings, OutboundQueueItem, OutboundCallType, OutboundStatus } from "@/lib/types";

const TOGGLES: { key: keyof ReminderSettings; label: string; hint: string }[] = [
  { key: "remind_24h_enabled", label: "24-hour reminder", hint: "Call each patient 1 day before their appointment." },
  { key: "remind_2h_enabled", label: "2-hour reminder", hint: "Call each patient 2 hours before their appointment." },
  { key: "call_on_doctor_unavailable_enabled", label: "Doctor-unavailable call", hint: "Notify patients when their doctor is marked unavailable." },
];

const CALL_TYPE_LABEL: Record<OutboundCallType, string> = {
  reminder_24h: "24h reminder",
  reminder_2h: "2h reminder",
  doctor_unavailable: "Doctor unavailable",
};

function statusTone(s: OutboundStatus): "gray" | "green" | "red" | "yellow" {
  if (s === "answered") return "green";
  if (s === "missed" || s === "cancelled") return "red";
  if (s === "placed") return "yellow";
  return "gray"; // queued
}

function Toggle({
  on, disabled, onChange, label, hint,
}: { on: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-gray-200 p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 disabled:opacity-50"
      />
    </label>
  );
}

function RemindersInner({ hospitalId }: { hospitalId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const readOnly = useReadOnly();

  const settingsQ = useQuery({
    queryKey: ["reminder-settings", hospitalId],
    queryFn: () => api.getReminderSettings(hospitalId),
    retry: false,
  });
  const queueQ = useQuery({
    queryKey: ["outbound-queue", hospitalId],
    queryFn: () => api.listOutboundQueue(hospitalId),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (next: ReminderSettings) => api.setReminderSettings(hospitalId, next),
    onSuccess: (data) => {
      qc.setQueryData(["reminder-settings", hospitalId], data);
      toast("Reminder settings saved");
    },
    onError: (e: Error) => toast(e.message, "err"),
  });

  const s = settingsQ.data;
  const setKey = (key: keyof ReminderSettings, v: boolean) => {
    if (!s) return;
    save.mutate({ ...s, [key]: v });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reminders" />

      <Card>
        <CardHeader>
          <span className="text-sm font-semibold text-gray-700">Automatic outbound calls</span>
        </CardHeader>
        <CardBody className="space-y-2">
          {settingsQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Loading…</div>
          ) : settingsQ.isError || !s ? (
            <EmptyState title="Reminder settings not available yet" hint="Ships with the outbound backend. The UI is ready." />
          ) : (
            TOGGLES.map((t) => (
              <Toggle
                key={t.key}
                label={t.label}
                hint={t.hint}
                on={!!s[t.key]}
                disabled={readOnly || save.isPending}
                onChange={(v) => setKey(t.key, v)}
              />
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <PhoneOutgoing className="h-4 w-4 text-gray-500" /> Outbound call queue
          </span>
          {queueQ.data && <Badge>{queueQ.data.length}</Badge>}
        </CardHeader>
        <CardBody className="p-0">
          {queueQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500"><Spinner /> Loading…</div>
          ) : queueQ.isError ? (
            <EmptyState title="Queue not available yet" hint="Ships with the outbound backend. The UI is ready." />
          ) : (queueQ.data?.length ?? 0) === 0 ? (
            <EmptyState title="No outbound calls scheduled" hint="Import appointments to schedule reminder calls." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Patient</th>
                    <th className="px-4 py-2 font-medium">Phone</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Scheduled</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queueQ.data!.map((q: OutboundQueueItem) => (
                    <tr key={q.id}>
                      <td className="px-4 py-2.5 text-gray-900">{q.patient_name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{q.phone ?? "—"}</td>
                      <td className="px-4 py-2.5"><Badge tone="blue">{CALL_TYPE_LABEL[q.call_type] ?? q.call_type}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-600">{q.scheduled_for ? fmtDateTime(q.scheduled_for) : "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={statusTone(q.status)}>{q.status}{q.attempts ? ` ·${q.attempts}` : ""}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function RemindersPage() {
  return <RequireHospital>{(hid) => <RemindersInner hospitalId={hid} />}</RequireHospital>;
}
