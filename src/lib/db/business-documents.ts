import { createClient } from '@/lib/supabase/server'
import type {
  BusinessDocument,
  DocumentType,
  UpsertBusinessDocumentInput,
} from '@/types'

export { computeDocumentStatus } from '@/lib/compliance/document-status'

/** List all business documents for the current user's shop. Ordered by document_type. */
export async function listBusinessDocuments(): Promise<BusinessDocument[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('business_documents')
    .select('*')
    .order('document_type')
  return (data as BusinessDocument[]) ?? []
}

/** Get a single business document by type for the current user's shop. */
export async function getBusinessDocument(
  type: DocumentType,
): Promise<BusinessDocument | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('business_documents')
    .select('*')
    .eq('document_type', type)
    .maybeSingle()
  return (data as BusinessDocument) ?? null
}

/**
 * Upsert the business document for the given type. Shop_id derived from JWT.
 * Relies on the UNIQUE(shop_id, document_type) index.
 */
export async function upsertBusinessDocument(
  type: DocumentType,
  input: UpsertBusinessDocumentInput,
): Promise<BusinessDocument> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const { data, error } = await supabase
    .from('business_documents')
    .upsert(
      { ...input, shop_id: shopId, document_type: type },
      { onConflict: 'shop_id,document_type' },
    )
    .select()
    .single()
  if (error) throw error
  return data as BusinessDocument
}

/** Delete the business document for the given type. RLS enforces shop ownership. */
export async function deleteBusinessDocument(type: DocumentType): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('business_documents')
    .delete()
    .eq('document_type', type)
  if (error) throw error
}
