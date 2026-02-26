// Supabase Edge Function: send-email
// Nodemailer ile Google SMTP üzerinden e-posta gönderir
// Body'de ids parametresi varsa sadece o ID'leri gönderir

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SMTP Ayarları
const SMTP_USER = "o.fitoz93@gmail.com";
const SMTP_PASS = "ntdkqyplkjzbzxoc";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Body'den filtreleme parametrelerini al
        let bodyParams: any = {};
        try {
            bodyParams = await req.json();
        } catch (_) { }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // E-postaları al — ids parametresi varsa sadece onları, yoksa tüm pending'leri
        let query = supabase
            .from("notification_queue")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(50);

        if (bodyParams.ids && Array.isArray(bodyParams.ids) && bodyParams.ids.length > 0) {
            query = query.in("id", bodyParams.ids);
        }

        const { data: emails, error } = await query;

        if (error) throw error;
        if (!emails || emails.length === 0) {
            return new Response(
                JSON.stringify({ message: "Gönderilecek e-posta yok" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Gmail SMTP transporter
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        let sentCount = 0;
        const results = [];

        for (const email of emails) {
            try {
                const info = await transporter.sendMail({
                    from: `"Bulut Otomasyon" <${SMTP_USER}>`,
                    to: email.to_email,
                    subject: email.subject,
                    html: email.body_html,
                });

                console.log("Mail gönderildi:", info.messageId);

                await supabase
                    .from("notification_queue")
                    .update({ status: "sent", sent_at: new Date().toISOString() })
                    .eq("id", email.id);

                sentCount++;
                results.push({ email: email.to_email, status: "sent" });
            } catch (sendErr: any) {
                console.error(`Gönderilemedi (${email.to_email}):`, sendErr.message);
                await supabase
                    .from("notification_queue")
                    .update({ status: "failed" })
                    .eq("id", email.id);
                results.push({ email: email.to_email, status: "failed", error: sendErr.message });
            }
        }

        return new Response(
            JSON.stringify({ message: `${sentCount}/${emails.length} e-posta gönderildi`, results }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err: any) {
        console.error("Edge Function Hatası:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
