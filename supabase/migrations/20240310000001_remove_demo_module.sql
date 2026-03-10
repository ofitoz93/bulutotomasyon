-- Dış anahtar kısıtlamaları nedeniyle önce atamaları sil
DELETE FROM user_module_access WHERE module_key = 'demo_module';
DELETE FROM company_modules WHERE module_key = 'demo_module';

-- Modül tanımını sil
DELETE FROM modules WHERE key = 'demo_module';
