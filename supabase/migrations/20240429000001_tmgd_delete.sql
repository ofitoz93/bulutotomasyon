-- Add RPC for deleting a document
CREATE OR REPLACE FUNCTION public.tmgd_public_delete_doc(p_doc_id UUID, p_client_id UUID)
RETURNS void AS $$
BEGIN
  -- Sadece draft statüsündeki kayıtlar silinebilir (veya istenirse hepsi, ama güvenlik için)
  DELETE FROM public.tmgd_transport_docs 
  WHERE id = p_doc_id AND client_id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
