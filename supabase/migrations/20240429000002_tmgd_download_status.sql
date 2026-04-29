-- Migration: Add is_downloaded to tmgd_transport_docs
ALTER TABLE public.tmgd_transport_docs ADD COLUMN IF NOT EXISTS is_downloaded BOOLEAN DEFAULT false;

-- Add an RPC to bulk update is_downloaded status
CREATE OR REPLACE FUNCTION public.tmgd_mark_docs_downloaded(p_doc_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE public.tmgd_transport_docs 
  SET is_downloaded = true 
  WHERE id = ANY(p_doc_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
