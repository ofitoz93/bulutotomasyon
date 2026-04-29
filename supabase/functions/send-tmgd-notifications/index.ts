import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || Deno.env.get('resend_api_key')

serve(async (req) => {
  // CORS ayarları
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }})
  }

  try {
    const { type, email, company_name } = await req.json()

    // 1. Deneme Maili Gönderimi
    if (type === 'test') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'TMGD Portal <onboarding@resend.dev>',
          to: email,
          subject: 'TMGD Portal - Sistem Test Maili',
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
              <h2 style="color: #4f46e5; margin-top: 0;">Sistem Testi Başarılı!</h2>
              <p>Merhaba <b>${company_name || 'TMGD Yöneticisi'}</b>,</p>
              <p>Bu mail, portal üzerindeki bildirim sisteminin (Supabase Edge Function + Resend) düzgün çalıştığını teyit etmek için gönderilmiştir.</p>
              <p>Artık evrak kotaları dolduğunda veya evraklar indirilmediğinde otomatik uyarılar alabileceksiniz.</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <p style="margin: 0; font-size: 14px; color: #374151;"><b>Durum:</b> Bağlantı Aktif</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #374151;"><b>Zaman:</b> ${new Date().toLocaleString('tr-TR')}</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 11px; color: #9ca3af; text-align: center;">Bu bir sistem mesajıdır, lütfen yanıtlamayınız.</p>
            </div>
          `,
        }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message || "Resend API Hatası" }), { 
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          status: 400 
        })
      }

      return new Response(JSON.stringify(data), { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200 
      })
    }

    return new Response(JSON.stringify({ error: "Invalid request type" }), { status: 400 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500 
    })
  }
})
