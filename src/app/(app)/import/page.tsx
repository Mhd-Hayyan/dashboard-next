"use client";
import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UploadCloud, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { RequireHospital } from "@/components/require-hospital";
import {
  PageHeader, Button, Field, Select, Card, CardHeader, CardBody, Spinner, EmptyState,
} from "@/components/ui";
import { useToast } from "@/components/providers";
import type { ImportResult } from "@/lib/types";

// A starter CSV the hospital can fill in — generated client-side, no upload needed.
const TEMPLATE = "patient_name,phone,datetime\nAnita Sharma,+919876543210,2026-06-25 10:30\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arteq-appointments-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ImportInner({ hospitalId }: { hospitalId: string }) {
  const toast = useToast();
  const [doctorId, setDoctorId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const { data: doctors = [], isError: doctorsError } = useQuery({
    queryKey: ["doctors", hospitalId],
    queryFn: () => api.listDoctors(hospitalId),
    retry: false,
  });

  const mut = useMutation({
    mutationFn: () => api.importAppointments(hospitalId, doctorId, file as File),
    onSuccess: (r) => {
      setResult(r);
      toast(`Imported ${r.imported} appointment${r.imported === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast(e.message, "err"),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import Appointments"
        action={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <span className="text-sm font-semibold text-gray-700">Upload a doctor's patient list</span>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">
            CSV or Excel with columns <code className="rounded bg-gray-100 px-1">patient_name</code>,{" "}
            <code className="rounded bg-gray-100 px-1">phone</code>,{" "}
            <code className="rounded bg-gray-100 px-1">datetime</code>. Each row becomes an appointment
            and schedules the reminder calls you've enabled.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Doctor">
              <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="" disabled>Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ""}</option>
                ))}
              </Select>
              {doctorsError && <p className="mt-1 text-xs text-amber-600">Couldn't load doctors.</p>}
              {!doctorsError && doctors.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">Add a doctor first (Doctors page).</p>
              )}
            </Field>
            <Field label="File (.csv, .xlsx)">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
            </Field>
          </div>

          <div>
            <Button onClick={() => mut.mutate()} disabled={!doctorId || !file || mut.isPending}>
              {mut.isPending ? <Spinner /> : <UploadCloud className="h-4 w-4" />} Import & schedule reminders
            </Button>
          </div>
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-gray-700">Import result</span>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {result.imported} appointment{result.imported === 1 ? "" : "s"} imported.
            </p>
            {result.skipped.length > 0 ? (
              <div>
                <p className="mb-1 flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped:
                </p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-gray-200 p-2 text-xs text-gray-600">
                  {result.skipped.map((s, i) => (
                    <li key={i}>Row {s.row}: {s.reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No rows skipped.</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default function ImportPage() {
  return <RequireHospital>{(hid) => <ImportInner hospitalId={hid} />}</RequireHospital>;
}
