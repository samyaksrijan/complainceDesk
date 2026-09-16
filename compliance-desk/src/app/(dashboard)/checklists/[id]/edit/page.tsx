"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { usePageTitle } from "@/lib/use-page-title"
import { ChecklistForm } from "@/components/checklist/checklist-form"
import { api } from "@/lib/api"
import { toast } from "sonner"

export default function EditChecklistPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [initialData, setInitialData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  usePageTitle(initialData?.name ? `Edit: ${initialData.name}` : "Edit Checklist")

  useEffect(() => {
    const fetchChecklist = async () => {
      setIsLoading(true)
      const { data, error } = await api.get(`/api/checklists/${id}`)

      if (error) {
        toast.error("Failed to load checklist")
        router.push("/checklists")
        return
      }

      setInitialData({
        name: data.name,
        description: data.description || "",
        isTemplate: data.isTemplate,
        items: data.items.map((item: any, index: number) => ({
          id: item.id,
          name: item.name,
          fieldType: item.fieldType,
          condition: item.condition,
          thresholdValue: item.thresholdValue,
          unit: item.unit || "",
          options: item.options || [],
          description: item.description || "",
          isRequired: item.isRequired,
          sortOrder: item.sortOrder ?? index,
        })),
      })
      setIsLoading(false)
    }
    fetchChecklist()
  }, [id, router])

  const handleSubmit = async (payload: any) => {
    return await api.put(`/api/checklists/${id}`, payload)
  }

  const handleSuccess = (data: any) => {
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
      initialData={initialData}
      onSubmit={handleSubmit}
      onSuccess={handleSuccess}
      cancelUrl={`/checklists/${id}`}
    />
  )
}
