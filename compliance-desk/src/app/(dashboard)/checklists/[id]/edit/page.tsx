"use client"

import { ChecklistForm } from "@/components/checklist/checklist-form"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function EditChecklistPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [initialData, setInitialData] = useState<import("@/components/checklist/checklist-form").ChecklistFormProps["initialData"] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  usePageTitle(initialData?.name ? `Edit: ${initialData.name}` : "Edit Checklist")

  useEffect(() => {
    const fetchChecklist = async () => {
      setIsLoading(true)
      const { data, error } = await api.get<import("../page").ChecklistDetail>(`/api/checklists/${id}`)

      if (error || !data) {
        toast.error("Failed to load checklist")
        router.push("/checklists")
        return
      }

      setInitialData({
        name: data.name,
        description: data.description || "",
        isTemplate: data.isTemplate,
        items: data.items.map((item, index: number) => ({
          id: item.id,
          fieldName: item.fieldName,
          fieldType: item.fieldType,
          condition: item.condition,
          thresholdValue: item.thresholdValue,
          unit: item.unit || "",
          options: item.options || [],
          description: item.sourceText || "",
          isRequired: item.isRequired,
          sortOrder: item.sortOrder ?? index,
        })),
      })
      setIsLoading(false)
    }
    fetchChecklist()
  }, [id, router])

  const handleSubmit = async (payload: import("@/lib/validation").CreateChecklistInput) => {
    return await api.put<{ id: string }>(`/api/checklists/${id}`, payload)
  }

  const handleSuccess = () => {
    toast.success("Checklist updated")
    router.push(`/checklists/${id}`)
  }

  if (isLoading) {
    return (
      <div className="animate-fade-up max-w-4xl">
        <div className="space-y-4">
          <div className="h-6 w-32 rounded animate-shimmer-green" />
          <div className="h-10 w-2/3 rounded animate-shimmer-green" />
          <div className="h-20 rounded-xl animate-shimmer-green" />
          <div className="h-20 rounded-xl animate-shimmer-green" />
          <div className="h-20 rounded-xl animate-shimmer-green" />
        </div>
      </div>
    )
  }

  return (
    <ChecklistForm
      mode="edit"
      initialData={initialData || undefined}
      onSubmit={handleSubmit}
      onSuccess={handleSuccess}
      cancelUrl={`/checklists/${id}`}
    />
  )
}
