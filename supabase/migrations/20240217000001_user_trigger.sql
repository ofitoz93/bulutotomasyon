-- Yeni kullanıcı oluştuğunda çalışacak fonksiyon
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    -- Eğer metadata'da rol yoksa varsayılan olarak 'employee' yap, ama biz bunu elle değiştireceğiz
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'employee')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger tanımlaması (auth.users tablosunda her satır eklendiğinde çalışır)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
