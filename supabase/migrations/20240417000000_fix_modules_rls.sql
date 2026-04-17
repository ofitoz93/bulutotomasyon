-- modules tablosuna sistem yöneticileri için UPDATE, INSERT, DELETE politikaları ekle
-- Mevcut SELECT politikası var ama yazma politikaları eksikti

-- Sistem yöneticileri modülleri güncelleyebilir (kategori, ad, açıklama vb.)
CREATE POLICY "Sistem yöneticileri modülleri güncelleyebilir"
ON public.modules
FOR UPDATE
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Sistem yöneticileri yeni modül ekleyebilir
CREATE POLICY "Sistem yöneticileri modül ekleyebilir"
ON public.modules
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin());

-- Sistem yöneticileri modül silebilir
CREATE POLICY "Sistem yöneticileri modül silebilir"
ON public.modules
FOR DELETE
TO authenticated
USING (public.is_system_admin());

-- Şema önbelleğini yenile
NOTIFY pgrst, 'reload schema';
