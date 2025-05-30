// app/email/[id]/page.tsx
"use client"

import { use } from "react"
import EmailDetailPage from "@/components/email/EmailDetailPage"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EmailPage({ params }: PageProps) {
  const { id } = use(params)
  
  return <EmailDetailPage emailId={id} />
}