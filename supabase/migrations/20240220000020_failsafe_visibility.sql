-- RLS Politikalarını Sona Kadar Garanti Altına Al
-- Kullanıcı kendi oluşturduğu formu koşulsuz şartsız görebilmelidir.

-- 1. adr_forms
DROP POLICY IF EXISTS "Kullanıcı Kendi Formlarını Görür" ON public.adr_forms;
CREATE POLICY "Kullanıcı Kendi Formlarını Görür" ON public.adr_forms
FOR SELECT USING (
    auth.uid() = user_id
);

-- Eski politikalar yetersiz kalmamalı, ama bu "kendi formum" garantisidir.
-- Eğer önceki politika "şirketimdekileri gör" ise ve şirketim NULL ise göremezdim.
-- Artık görebilirim.

-- 2. form_answers
DROP POLICY IF EXISTS "Kullanıcı Kendi Cevaplarını Görür" ON public.form_answers;
CREATE POLICY "Kullanıcı Kendi Cevaplarını Görür" ON public.form_answers
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = public.form_answers.form_id
        AND f.user_id = auth.uid() 
    )
);

-- 3. form_media
DROP POLICY IF EXISTS "Kullanıcı Kendi Medyasını Görür" ON public.form_media;
CREATE POLICY "Kullanıcı Kendi Medyasını Görür" ON public.form_media
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = public.form_media.form_id
        AND f.user_id = auth.uid()
    )
);


-- Hata Ayıklama Yardımcısı: RLS'i Geçici Olarak Devre Dışı Bırakabiliriz (Debug için)
-- ALTER TABLE public.adr_forms DISABLE ROW LEVEL SECURITY;
-- (Bunu yapmıyorum çünkü güvenlik önemli, ama yukarıdaki politikalar yeterli olmalı)

-- Reload Schema
NOTIFY pgrst, 'reload schema';
