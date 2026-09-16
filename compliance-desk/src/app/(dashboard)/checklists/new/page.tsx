"use client"

import { useRouter } from "next/navigation"
import { usePageTitle } from "@/lib/use-page-title"
import { ChecklistForm } from "@/components/checklist/checklist-form"
import { api } from "@/lib/api"

export default function NewChecklistPage() {
  const router = useRouter()
  usePageTitle("Create Checklist")

  const handleSubmit = async (payload: any) => {
    return await api.post("/api/checklists", payload)
  }

  const handleSuccess = (data: any) => {
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
