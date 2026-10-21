"use client"

import { ChecklistForm } from "@/components/checklist/checklist-form"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { useRouter } from "next/navigation"

export default function NewChecklistPage() {
  const router = useRouter()
  usePageTitle("Create Checklist")

  const handleSubmit = async (payload: import("@/lib/validation").CreateChecklistInput) => {
    return await api.post<{ id: string }>("/api/checklists", payload)
  }

  const handleSuccess = (data: { id: string }) => {
    router.push(`/checklists/${data.id}`)
  }

  return (
    <ChecklistForm
      mode="create"
      onSubmit={handleSubmit}
      onSuccess={handleSuccess}
      cancelUrl="/checklists"
    />
  )
}
